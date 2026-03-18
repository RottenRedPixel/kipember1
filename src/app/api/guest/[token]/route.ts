import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isGuestUserEmail } from '@/lib/guest-embers';
import { refreshVoiceCallFromProvider } from '@/lib/voice-calls';

const STALE_VOICE_CALL_MS = 45 * 1000;

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
        conversation: {
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
            callSummary: true,
            memorySyncedAt: true,
          },
        },
        image: {
          include: {
            owner: {
              select: {
                email: true,
              },
            },
            analysis: {
              select: {
                status: true,
                summary: true,
                visualDescription: true,
                mood: true,
                errorMessage: true,
              },
            },
            wiki: {
              select: {
                id: true,
                content: true,
                version: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!contributor || !isGuestUserEmail(contributor.image.owner.email)) {
      return NextResponse.json(
        { error: 'Guest memory not found' },
        {
          status: 404,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    const latestVoiceCall = contributor.voiceCalls[0] ?? null;
    if (
      latestVoiceCall &&
      (!latestVoiceCall.memorySyncedAt || ['registered', 'ongoing'].includes(latestVoiceCall.status)) &&
      Date.now() - latestVoiceCall.createdAt.getTime() > STALE_VOICE_CALL_MS
    ) {
      try {
        await refreshVoiceCallFromProvider(latestVoiceCall.id);
      } catch (refreshError) {
        console.error('Failed to refresh guest voice call from provider:', refreshError);
      }
    }

    const refreshedContributor = await prisma.contributor.findUnique({
      where: { token },
      include: {
        conversation: {
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
            callSummary: true,
            memorySyncedAt: true,
          },
        },
        image: {
          include: {
            owner: {
              select: {
                email: true,
              },
            },
            analysis: {
              select: {
                status: true,
                summary: true,
                visualDescription: true,
                mood: true,
                errorMessage: true,
              },
            },
            wiki: {
              select: {
                id: true,
                content: true,
                version: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!refreshedContributor || !isGuestUserEmail(refreshedContributor.image.owner.email)) {
      return NextResponse.json(
        { error: 'Guest memory not found' },
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
          createdAt: refreshedContributor.image.createdAt,
        },
        analysis: refreshedContributor.image.analysis,
        conversation: refreshedContributor.conversation
          ? {
              status: refreshedContributor.conversation.status,
              currentStep: refreshedContributor.conversation.currentStep,
              messages: refreshedContributor.conversation.messages,
            }
          : null,
        latestVoiceCall: refreshedContributor.voiceCalls[0] ?? null,
        wiki: refreshedContributor.image.wiki,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Error loading guest memory:', error);
    return NextResponse.json(
      { error: 'Failed to load guest memory' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
