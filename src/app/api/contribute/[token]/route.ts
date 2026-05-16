import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  emberSessionParticipantWhere,
  ensureEmberSession,
} from '@/lib/ember-sessions';
import { generateEmberChatReply } from '@/lib/ember-chat-reply';
import { reconcileEmberMessageSafely } from '@/lib/memory-reconciliation';
import { PROMPT_REMOVED_MESSAGE, isPromptRemovedError } from '@/lib/control-plane';
import { refreshVoiceCallFromProvider, shouldRefreshVoiceCallStatus } from '@/lib/voice-calls';

// GET - Fetch contributor info and session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    void request;

    const { token } = await params;

    const tokenInclude = {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          passwordHash: true,
        },
      },
      ember: {
        include: {
          owner: {
            select: {
              email: true,
            },
          },
          analysis: {
            select: {
              capturedAt: true,
            },
          },
        },
      },
      emberSession: {
        include: {
          messages: {
            orderBy: { createdAt: 'asc' as const },
          },
        },
      },
      voiceCalls: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: {
          id: true,
          status: true,
          startedAt: true,
          endedAt: true,
          createdAt: true,
          updatedAt: true,
          analyzedAt: true,
          callSummary: true,
          memorySyncedAt: true,
        },
      },
    };

    const emberContributor = await prisma.emberContributor.findUnique({
      where: { token },
      include: tokenInclude,
    });

    if (!emberContributor) {
      return NextResponse.json(
        { error: 'Invalid or expired link' },
        {
          status: 404,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    const latestVoiceCall = emberContributor.voiceCalls[0] ?? null;
    if (shouldRefreshVoiceCallStatus(latestVoiceCall)) {
      try {
        await refreshVoiceCallFromProvider(latestVoiceCall.id);
      } catch (refreshError) {
        console.error('Failed to refresh contributor voice call from provider:', refreshError);
      }
    }

    const refreshedContributor = await prisma.emberContributor.findUnique({
      where: { token },
      include: tokenInclude,
    });

    if (!refreshedContributor) {
      return NextResponse.json(
        { error: 'Invalid or expired link' },
        {
          status: 404,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    return NextResponse.json(
      {
        guestFlow: true,
        contributor: {
          id: refreshedContributor.id,
          name: [refreshedContributor.user?.firstName, refreshedContributor.user?.lastName].filter(Boolean).join(' ') || refreshedContributor.user?.email || refreshedContributor.user?.phoneNumber || null,
          firstName: refreshedContributor.user?.firstName ?? null,
          phoneNumber: refreshedContributor.user?.phoneNumber ?? null,
          hasPassword: !!refreshedContributor.user?.passwordHash,
        },
        ember: {
          id: refreshedContributor.ember.id,
          filename: refreshedContributor.ember.filename,
          mediaType: refreshedContributor.ember.mediaType,
          posterFilename: refreshedContributor.ember.posterFilename,
          durationSeconds: refreshedContributor.ember.durationSeconds,
          originalName: refreshedContributor.ember.originalName,
          title: refreshedContributor.ember.title,
          description: refreshedContributor.ember.description,
          createdAt: refreshedContributor.ember.createdAt,
          capturedAt: refreshedContributor.ember.analysis?.capturedAt
            ? refreshedContributor.ember.analysis.capturedAt.toISOString()
            : null,
        },
        conversation: refreshedContributor.emberSession,
        latestVoiceCall: refreshedContributor.voiceCalls[0] ?? null,
        attachments: await prisma.emberAttachment
          .findMany({
            where: { emberId: refreshedContributor.ember.id },
            select: { id: true, filename: true, mediaType: true, posterFilename: true },
            orderBy: { createdAt: 'asc' },
          })
          .catch(() => []),
        snapshotScript: await prisma.snapshot
          .findUnique({ where: { emberId: refreshedContributor.ember.id }, select: { script: true } })
          .then((sc) => sc?.script ?? null)
          .catch(() => null),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching contributor:', error);
    return NextResponse.json(
      { error: 'Failed to load' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

// POST - Handle chat message from contributor / guest
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

    const emberContributor = await prisma.emberContributor.findUnique({
      where: { token },
      select: {
        id: true,
        emberId: true,
        userId: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true,
          },
        },
      },
    });

    if (!emberContributor) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }

    const contributor = {
      id: emberContributor.id,
      emberId: emberContributor.emberId,
      userId: emberContributor.userId,
    };

    const sessionIdentity = {
      emberId: contributor.emberId,
      sessionType: 'chat' as const,
      participantType: 'contributor' as const,
      participantId: contributor.id,
    };

    let session = await prisma.emberSession.findUnique({
      where: emberSessionParticipantWhere(sessionIdentity),
    });

    const isStart = message === '__START__';

    if (!session) {
      session = await ensureEmberSession({
        ...sessionIdentity,
        emberContributorId: contributor.id,
        browserId: null,
        status: 'active',
      });

      const welcome = await generateEmberChatReply({
        emberId: contributor.emberId,
        sessionId: session.id,
        role: 'contributor',
        trigger: 'welcome_first_open',
      });
      await prisma.emberMessage.create({
        data: { sessionId: session.id, role: 'assistant', content: welcome, source: 'web' },
      });

      if (isStart) {
        return NextResponse.json({ response: welcome });
      }
    } else if (isStart) {
      const userReplyCount = await prisma.emberMessage.count({
        where: { sessionId: session.id, role: 'user' },
      });

      if (userReplyCount > 0) {
        const latest = await prisma.emberMessage.findFirst({
          where: { sessionId: session.id, role: 'assistant' },
          orderBy: { createdAt: 'desc' },
        });
        if (latest) {
          return NextResponse.json({ response: latest.content });
        }
      } else {
        await prisma.emberMessage.deleteMany({
          where: { sessionId: session.id, role: 'assistant' },
        });
      }

      const welcome = await generateEmberChatReply({
        emberId: contributor.emberId,
        sessionId: session.id,
        role: 'contributor',
        trigger: 'welcome_returning',
      });
      await prisma.emberMessage.create({
        data: { sessionId: session.id, role: 'assistant', content: welcome, source: 'web' },
      });
      return NextResponse.json({ response: welcome });
    }

    const userMessage = await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
        source: 'web',
      },
    });

    const [reply] = await Promise.all([
      generateEmberChatReply({
        emberId: contributor.emberId,
        sessionId: session.id,
        role: 'contributor',
        trigger: 'message',
      }),
      reconcileEmberMessageSafely(userMessage.id, 'contribute housekeeping'),
    ]);

    await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: reply,
        source: 'web',
      },
    });

    return NextResponse.json({ response: reply });
  } catch (error) {
    console.error('Chat error:', error);
    if (isPromptRemovedError(error)) {
      return NextResponse.json({ error: PROMPT_REMOVED_MESSAGE }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
}
