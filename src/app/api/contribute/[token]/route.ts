import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  emberSessionParticipantWhere,
  ensureEmberSession,
} from '@/lib/ember-sessions';
import { generateEmberChatReply } from '@/lib/ember-chat-reply';
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

    const contributor = await prisma.contributor.findUnique({
      where: { token },
      include: {
        image: {
          include: {
            owner: {
              select: {
                email: true,
              },
            },
          },
        },
        emberSession: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        voiceCalls: {
          orderBy: { createdAt: 'desc' },
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
      },
    });

    if (!contributor) {
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

    const latestVoiceCall = contributor.voiceCalls[0] ?? null;
    if (shouldRefreshVoiceCallStatus(latestVoiceCall)) {
      try {
        await refreshVoiceCallFromProvider(latestVoiceCall.id);
      } catch (refreshError) {
        console.error('Failed to refresh contributor voice call from provider:', refreshError);
      }
    }

    const refreshedContributor = await prisma.contributor.findUnique({
      where: { token },
      include: {
        image: {
          include: {
            owner: {
              select: {
                email: true,
              },
            },
          },
        },
        emberSession: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        voiceCalls: {
          orderBy: { createdAt: 'desc' },
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
      },
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
        contributor: {
          id: refreshedContributor.id,
          name: refreshedContributor.name,
          phoneNumber: refreshedContributor.phoneNumber,
        },
        image: {
          id: refreshedContributor.image.id,
          filename: refreshedContributor.image.filename,
          mediaType: refreshedContributor.image.mediaType,
          posterFilename: refreshedContributor.image.posterFilename,
          durationSeconds: refreshedContributor.image.durationSeconds,
          originalName: refreshedContributor.image.originalName,
          title: refreshedContributor.image.title,
          description: refreshedContributor.image.description,
        },
        conversation: refreshedContributor.emberSession,
        latestVoiceCall: refreshedContributor.voiceCalls[0] ?? null,
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

    const contributor = await prisma.contributor.findUnique({
      where: { token },
      select: { id: true, imageId: true },
    });

    if (!contributor) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }

    const sessionIdentity = {
      imageId: contributor.imageId,
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
        contributorId: contributor.id,
        status: 'active',
      });

      const welcome = await generateEmberChatReply('welcome_first_open');
      await prisma.emberMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: welcome,
          source: 'web',
        },
      });

      if (isStart) {
        return NextResponse.json({ response: welcome });
      }
    } else if (isStart) {
      const latest = await prisma.emberMessage.findFirst({
        where: { sessionId: session.id, role: 'assistant' },
        orderBy: { createdAt: 'desc' },
      });
      if (latest) {
        return NextResponse.json({ response: latest.content });
      }
      const welcome = await generateEmberChatReply('welcome_returning');
      await prisma.emberMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: welcome,
          source: 'web',
        },
      });
      return NextResponse.json({ response: welcome });
    }

    await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
        source: 'web',
      },
    });

    const reply = await generateEmberChatReply('message');

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
