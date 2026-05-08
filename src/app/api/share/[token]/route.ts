import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { ensureEmberSession, emberSessionParticipantWhere } from '@/lib/ember-sessions';
import { generateEmberChatReply } from '@/lib/ember-chat-reply';
import { reconcileEmberMessageSafely } from '@/lib/memory-reconciliation';
import { PROMPT_REMOVED_MESSAGE, isPromptRemovedError } from '@/lib/control-plane';

const GUEST_BROWSER_COOKIE = 'kb-guest-browser';
const GUEST_BROWSER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function withGuestCookie(response: NextResponse, guestBrowserId: string | null, isNew: boolean) {
  if (guestBrowserId && isNew) {
    response.cookies.set(GUEST_BROWSER_COOKIE, guestBrowserId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: GUEST_BROWSER_COOKIE_MAX_AGE,
      path: '/',
    });
  }
  return response;
}

// GET — return image data for the public share screen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    void request;
    const { token } = await params;

    const image = await prisma.image.findUnique({
      where: { shareToken: token },
      include: {
        analysis: { select: { status: true, summary: true, visualDescription: true, mood: true, errorMessage: true } },
        wiki: { select: { id: true, content: true, version: true, updatedAt: true } },
      },
    });

    if (!image) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    if (image.keepPrivate) {
      return NextResponse.json({ error: 'This ember is private.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }

    const attachments = await prisma.imageAttachment.findMany({
      where: { imageId: image.id },
      select: { id: true, filename: true, mediaType: true, posterFilename: true },
      orderBy: { createdAt: 'asc' },
    });

    const snapshotScript = await prisma.snapshot
      .findUnique({ where: { imageId: image.id }, select: { script: true } })
      .then((s) => s?.script ?? null)
      .catch(() => null);

    return NextResponse.json(
      {
        guestFlow: true,
        contributor: null,
        image: {
          id: image.id,
          filename: image.filename,
          mediaType: image.mediaType,
          posterFilename: image.posterFilename,
          durationSeconds: image.durationSeconds,
          originalName: image.originalName,
          title: image.title,
          description: image.description,
          createdAt: image.createdAt,
        },
        analysis: image.analysis,
        conversation: null,
        latestVoiceCall: null,
        wiki: image.wiki,
        attachments,
        snapshotScript,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error loading shared memory:', error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

// POST — handle anonymous chat on a public share link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const image = await prisma.image.findUnique({
      where: { shareToken: token },
      select: { id: true },
    });

    if (!image) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }

    const existingBrowserId = request.cookies.get(GUEST_BROWSER_COOKIE)?.value;
    const guestBrowserId = existingBrowserId || randomUUID();
    const isNewCookie = !existingBrowserId;

    const sessionIdentity = {
      imageId: image.id,
      sessionType: 'chat' as const,
      participantType: 'guest' as const,
      participantId: guestBrowserId,
    };

    let session = await prisma.emberSession.findUnique({
      where: emberSessionParticipantWhere(sessionIdentity),
    });

    const isStart = message === '__START__';

    if (!session) {
      session = await ensureEmberSession({
        ...sessionIdentity,
        emberContributorId: null,
        browserId: guestBrowserId,
        status: 'active',
      });

      const welcome = await generateEmberChatReply({
        imageId: image.id,
        sessionId: session.id,
        role: 'guest',
        trigger: 'welcome_first_open',
      });
      await prisma.emberMessage.create({
        data: { sessionId: session.id, role: 'assistant', content: welcome, source: 'web' },
      });

      if (isStart) {
        return withGuestCookie(NextResponse.json({ response: welcome }), guestBrowserId, isNewCookie);
      }
    } else if (isStart) {
      const welcome = await generateEmberChatReply({
        imageId: image.id,
        sessionId: session.id,
        role: 'guest',
        trigger: 'welcome_returning',
      });
      await prisma.emberMessage.create({
        data: { sessionId: session.id, role: 'assistant', content: welcome, source: 'web' },
      });
      return withGuestCookie(NextResponse.json({ response: welcome }), guestBrowserId, isNewCookie);
    }

    const userMessage = await prisma.emberMessage.create({
      data: { sessionId: session.id, role: 'user', content: message, source: 'web' },
    });

    const [reply] = await Promise.all([
      generateEmberChatReply({ imageId: image.id, sessionId: session.id, role: 'guest', trigger: 'message' }),
      reconcileEmberMessageSafely(userMessage.id, 'share housekeeping'),
    ]);

    await prisma.emberMessage.create({
      data: { sessionId: session.id, role: 'assistant', content: reply, source: 'web' },
    });

    return withGuestCookie(NextResponse.json({ response: reply }), guestBrowserId, isNewCookie);
  } catch (error) {
    console.error('Share chat error:', error);
    if (isPromptRemovedError(error)) {
      return NextResponse.json({ error: PROMPT_REMOVED_MESSAGE }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
}
