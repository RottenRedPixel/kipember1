import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireApiUser } from '@/lib/auth-server';
import { prisma } from '@/lib/db';
import { generateChatWelcome, type ChatWelcomeRole, type ChatWelcomeSituation } from '@/lib/chat-welcome';
import {
  ensureEmberSession,
  type EmberParticipantType,
} from '@/lib/ember-sessions';
import { getImageAccessType } from '@/lib/ember-access';

const COOKIE_NAME = 'kb-chat-browser';

async function resolveParticipant(userId: string, imageId: string) {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: {
      ownerId: true,
      contributors: {
        where: { userId },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!image) return null;

  const participantType: EmberParticipantType =
    image.ownerId === userId ? 'owner' : image.contributors.length ? 'contributor' : 'guest';

  return { participantType };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const imageId = typeof body?.imageId === 'string' ? body.imageId : '';
    const situation: ChatWelcomeSituation =
      body?.situation === 'returning' ? 'returning' : 'first_open';

    if (!imageId) {
      return NextResponse.json({ error: 'imageId is required' }, { status: 400 });
    }

    const accessType = await getImageAccessType(auth.user.id, imageId);
    if (!accessType) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const participant = await resolveParticipant(auth.user.id, imageId);
    if (!participant) return NextResponse.json({ error: 'Image not found' }, { status: 404 });

    const existingBrowserId = request.cookies.get(COOKIE_NAME)?.value;
    const browserId = existingBrowserId || randomUUID();

    const session = await ensureEmberSession({
      imageId,
      sessionType: 'chat',
      participantType: participant.participantType,
      participantId: auth.user.id,
      userId: auth.user.id,
      browserId,
      status: 'active',
    });

    // Idempotent: if an assistant message already exists, return the first one.
    const existing = await prisma.emberMessage.findFirst({
      where: { sessionId: session.id, role: 'assistant' },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      const response = NextResponse.json({ message: existing.content });
      if (!existingBrowserId || session.browserId !== browserId) {
        response.cookies.set(COOKIE_NAME, session.browserId ?? browserId, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 365,
          path: '/',
        });
      }
      return response;
    }

    const welcome = await generateChatWelcome({
      imageId,
      participantRole: participant.participantType as ChatWelcomeRole,
      participantFirstName: auth.user.name,
      situation,
    });

    await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: welcome,
        source: 'web',
      },
    });

    const response = NextResponse.json({ message: welcome });
    if (!existingBrowserId || session.browserId !== browserId) {
      response.cookies.set(COOKIE_NAME, session.browserId ?? browserId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      });
    }
    return response;
  } catch (error) {
    console.error('Chat welcome error:', error);
    return NextResponse.json({ error: 'Failed to generate welcome' }, { status: 500 });
  }
}
