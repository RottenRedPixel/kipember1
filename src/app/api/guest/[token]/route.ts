import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { refreshVoiceCallFromProvider, shouldRefreshVoiceCallStatus } from '@/lib/voice-calls';

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
        image: {
          include: {
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

    if (!contributor) {
      return NextResponse.json(
        { error: 'Guest memory not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (contributor.image.keepPrivate) {
      return NextResponse.json(
        { error: 'This ember is private.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Log a guest view for the owner's home-activity counter. Fire-and-forget;
    // a DB hiccup here must not block the guest's page load.
    prisma.guestView.create({ data: { contributorId: contributor.id } }).catch((err) => {
      console.error('Failed to log guest view:', err);
    });

    const latestVoiceCall = contributor.voiceCalls[0] ?? null;
    if (shouldRefreshVoiceCallStatus(latestVoiceCall)) {
      try {
        await refreshVoiceCallFromProvider(latestVoiceCall.id);
      } catch (refreshError) {
        console.error('Failed to refresh guest voice call from provider:', refreshError);
      }
    }

    const refreshedContributor = await prisma.contributor.findUnique({
      where: { token },
      include: {
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
        image: {
          include: {
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

    if (!refreshedContributor) {
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
        conversation: refreshedContributor.emberSession
          ? {
              status: refreshedContributor.emberSession.status,
              currentStep: refreshedContributor.emberSession.currentStep,
              messages: refreshedContributor.emberSession.messages,
            }
          : null,
        latestVoiceCall: refreshedContributor.voiceCalls[0] ?? null,
        wiki: refreshedContributor.image.wiki,
        attachments: await prisma.imageAttachment
          .findMany({
            where: { imageId: refreshedContributor.image.id },
            select: { id: true, filename: true, mediaType: true, posterFilename: true },
            orderBy: { createdAt: 'asc' },
          })
          .catch(() => []),
        snapshotScript: await prisma.snapshot
          .findUnique({ where: { imageId: refreshedContributor.image.id }, select: { script: true } })
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
