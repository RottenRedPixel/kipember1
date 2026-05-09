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
import { extractAllClaimsFromContent } from '@/lib/memory-reconciliation';
import { getUserDisplayName } from '@/lib/user-name';
import { generateWikiForImage } from '@/lib/wiki-generator';

const COOKIE_NAME = 'mw_photo_chat_v2';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const HISTORY_LIMIT = 30;

async function resolveUserChatParticipant({
  emberId,
  userId,
}: {
  emberId: string;
  userId: string;
}) {
  const ember = await prisma.ember.findUnique({
    where: { id: emberId },
    select: {
      ownerId: true,
      emberContributors: {
        where: { userId },
        select: { id: true },
        take: 1,
      },
    },
  });

  const participantType: EmberParticipantType =
    ember?.ownerId === userId
      ? 'owner'
      : ember?.emberContributors.length
        ? 'contributor'
        : 'guest';

  return {
    emberId,
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

    const { emberId, message } = await request.json();
    if (!emberId || !message) {
      return NextResponse.json({ error: 'emberId and message are required' }, { status: 400 });
    }

    const accessType = await getEmberAccessType(auth.user.id, emberId);
    if (!accessType) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const existingBrowserId = request.cookies.get(COOKIE_NAME)?.value;
    const browserId = existingBrowserId || randomUUID();
    const userId = auth.user.id;

    const participant = await resolveUserChatParticipant({ emberId, userId });
    const session = await ensureChatSessionForParticipant({ participant, browserId, userId });

    const userMessage = await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
        source: 'web',
      },
    });

    const response = await generateEmberChatReply({
      emberId,
      sessionId: session.id,
      role: participant.participantType,
      trigger: 'message',
      userFirstName: auth.user.firstName ?? undefined,
    });

    // Fire housekeeping extraction after the reply is ready — do not await,
    // so the HTTP response is not held up by 5+ extra AI calls.
    extractAllClaimsFromContent(
      {
        emberId,
        sessionId: session.id,
        emberContributorId: session.emberContributorId ?? null,
        userId,
        emberMessageId: userMessage.id,
        source: 'chat',
        questionType: null,
        question: null,
        content: message,
        sourceLabel: getUserDisplayName(auth.user) || auth.user.email || userId,
      },
      'chat housekeeping'
    ).then(() => generateWikiForImage(emberId)).catch((err) => {
      console.error('Chat housekeeping extraction error:', err);
    });

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
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Chat error:', detail, error);
    if (isPromptRemovedError(error)) {
      return NextResponse.json({ error: PROMPT_REMOVED_MESSAGE }, { status: 500 });
    }
    return NextResponse.json({ error: `Failed to process chat message: ${detail}` }, { status: 500 });
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
    const emberId = searchParams.get('emberId');
    if (!emberId) return NextResponse.json({ error: 'emberId is required' }, { status: 400 });

    const accessType = await getEmberAccessType(auth.user.id, emberId);
    if (!accessType) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const userId = auth.user.id;
    const participant = await resolveUserChatParticipant({ emberId, userId });

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

    const { emberId, imageFilename } = await request.json();
    if (!emberId || !imageFilename) {
      return NextResponse.json({ error: 'emberId and imageFilename are required' }, { status: 400 });
    }

    const accessType = await getEmberAccessType(auth.user.id, emberId);
    if (!accessType) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const userId = auth.user.id;
    const existingBrowserId = request.cookies.get(COOKIE_NAME)?.value;
    const browserId = existingBrowserId || randomUUID();

    const participant = await resolveUserChatParticipant({ emberId, userId });
    const session = await ensureChatSessionForParticipant({ participant, browserId, userId });

    await prisma.emberMessage.create({
      data: { sessionId: session.id, role: 'user', content: '', imageFilename },
    });

    const reply = await generateEmberChatReply({
      emberId,
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
    console.error('Chat ember record error:', error);
    if (isPromptRemovedError(error)) {
      return NextResponse.json({ error: PROMPT_REMOVED_MESSAGE }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to record image' }, { status: 500 });
  }
}
