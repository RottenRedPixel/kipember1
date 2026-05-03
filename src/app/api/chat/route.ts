import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { PROMPT_REMOVED_MESSAGE, isFeatureEnabled, isPromptRemovedError } from '@/lib/control-plane';
import { prisma } from '@/lib/db';
import {
  emberSessionParticipantWhere,
  ensureEmberSession,
  type EmberParticipantType,
} from '@/lib/ember-sessions';
import { getEmberAccessType } from '@/lib/ember';
import { generateEmberChatReply } from '@/lib/ember-chat-reply';
import { reconcileEmberMessageSafely } from '@/lib/memory-reconciliation';

const COOKIE_NAME = 'mw_photo_chat_v2';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const HISTORY_LIMIT = 30;

async function resolveUserChatParticipant({
  imageId,
  userId,
}: {
  imageId: string;
  userId: string;
}) {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: {
      ownerId: true,
      emberContributors: {
        where: { contributor: { userId } },
        select: { id: true },
        take: 1,
      },
    },
  });

  const participantType: EmberParticipantType =
    image?.ownerId === userId
      ? 'owner'
      : image?.emberContributors.length
        ? 'contributor'
        : 'guest';

  return {
    imageId,
    sessionType: 'chat' as const,
    participantType,
    participantId: userId,
  };
}

type ResolvedParticipant = Awaited<ReturnType<typeof resolveUserChatParticipant>>;

async function ensureChatSessionForParticipant({
  participant,
  browserId,
  userId,
}: {
  participant: ResolvedParticipant;
  browserId: string;
  userId: string;
}) {
  return ensureEmberSession({
    ...participant,
    browserId,
    userId,
    status: 'active',
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!(await isFeatureEnabled('ask_ember', true))) {
      return NextResponse.json({ error: 'Ask Ember is currently disabled' }, { status: 503 });
    }

    const { imageId, message } = await request.json();
    if (!imageId || !message) {
      return NextResponse.json({ error: 'imageId and message are required' }, { status: 400 });
    }

    const accessType = await getEmberAccessType(auth.user.id, imageId);
    if (!accessType) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const existingBrowserId = request.cookies.get(COOKIE_NAME)?.value;
    const browserId = existingBrowserId || randomUUID();
    const userId = auth.user.id;

    const participant = await resolveUserChatParticipant({ imageId, userId });
    const session = await ensureChatSessionForParticipant({ participant, browserId, userId });

    const userMessage = await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
        source: 'web',
      },
    });

    const [response] = await Promise.all([
      generateEmberChatReply({
        imageId,
        sessionId: session.id,
        role: participant.participantType,
        trigger: 'message',
      }),
      reconcileEmberMessageSafely(userMessage.id, 'chat housekeeping'),
    ]);

    await prisma.emberMessage.create({
      data: { sessionId: session.id, role: 'assistant', content: response },
    });

    const nextResponse = NextResponse.json({ response });
    if (!existingBrowserId || session.browserId !== browserId) {
      nextResponse.cookies.set(COOKIE_NAME, session.browserId ?? browserId, {
        httpOnly: true, sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE, path: '/',
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('Chat error:', error);
    if (isPromptRemovedError(error)) {
      return NextResponse.json({ error: PROMPT_REMOVED_MESSAGE }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!(await isFeatureEnabled('ask_ember', true))) {
      return NextResponse.json({ error: 'Ask Ember is currently disabled' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageId');
    if (!imageId) return NextResponse.json({ error: 'imageId is required' }, { status: 400 });

    const accessType = await getEmberAccessType(auth.user.id, imageId);
    if (!accessType) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const userId = auth.user.id;
    const participant = await resolveUserChatParticipant({ imageId, userId });

    const session = await prisma.emberSession.findUnique({
      where: emberSessionParticipantWhere(participant),
    });

    const history = session
      ? await prisma.emberMessage.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: 'asc' },
          take: HISTORY_LIMIT,
        })
      : [];

    const messages = history.map((entry) => ({
      role: entry.role,
      content: entry.content,
      source: 'web' as const,
      imageFilename: entry.imageFilename ?? null,
      audioUrl: null as string | null,
      createdAt: entry.createdAt.toISOString(),
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json({ error: 'Failed to load chat history' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { imageId, imageFilename } = await request.json();
    if (!imageId || !imageFilename) {
      return NextResponse.json({ error: 'imageId and imageFilename are required' }, { status: 400 });
    }

    const accessType = await getEmberAccessType(auth.user.id, imageId);
    if (!accessType) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const userId = auth.user.id;
    const existingBrowserId = request.cookies.get(COOKIE_NAME)?.value;
    const browserId = existingBrowserId || randomUUID();

    const participant = await resolveUserChatParticipant({ imageId, userId });
    const session = await ensureChatSessionForParticipant({ participant, browserId, userId });

    await prisma.emberMessage.create({
      data: { sessionId: session.id, role: 'user', content: '', imageFilename },
    });

    const reply = await generateEmberChatReply({
      imageId,
      sessionId: session.id,
      role: participant.participantType,
      trigger: 'photo_upload',
    });

    await prisma.emberMessage.create({
      data: { sessionId: session.id, role: 'assistant', content: reply },
    });

    const response = NextResponse.json({ ok: true, response: reply });
    if (!existingBrowserId || session.browserId !== browserId) {
      response.cookies.set(COOKIE_NAME, session.browserId ?? browserId, {
        httpOnly: true, sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE, path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('Chat image record error:', error);
    if (isPromptRemovedError(error)) {
      return NextResponse.json({ error: PROMPT_REMOVED_MESSAGE }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to record image' }, { status: 500 });
  }
}
