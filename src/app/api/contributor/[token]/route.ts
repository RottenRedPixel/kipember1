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

    const tokenInclude = {
      user: true,
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
      ember: {
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
    };

    const emberContributor = await prisma.emberContributor.findUnique({
      where: { token },
      include: tokenInclude,
    });

    if (!emberContributor) {
      return NextResponse.json(
        { error: 'Guest memory not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (emberContributor.ember.keepPrivate) {
      return NextResponse.json(
        { error: 'This ember is private.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Log a guest view for the owner's home-activity counter. Fire-and-forget.
    prisma.guestView
      .create({ data: { emberContributorId: emberContributor.id } })
      .catch((err) => {
        console.error('Failed to log guest view:', err);
      });

    const latestVoiceCall = emberContributor.voiceCalls[0] ?? null;
    if (shouldRefreshVoiceCallStatus(latestVoiceCall)) {
      try {
        await refreshVoiceCallFromProvider(latestVoiceCall.id);
      } catch (refreshError) {
        console.error('Failed to refresh guest voice call from provider:', refreshError);
      }
    }

    const refreshedContributor = await prisma.emberContributor.findUnique({
      where: { token },
      include: tokenInclude,
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
          name: [refreshedContributor.user.firstName, refreshedContributor.user.lastName].filter(Boolean).join(' ') || null,
          firstName: refreshedContributor.user.firstName,
          phoneNumber: refreshedContributor.user.phoneNumber,
          hasPassword: !!refreshedContributor.user.passwordHash,
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
        },
        analysis: refreshedContributor.ember.analysis,
        conversation: refreshedContributor.emberSession
          ? {
              status: refreshedContributor.emberSession.status,
              currentStep: refreshedContributor.emberSession.currentStep,
              messages: refreshedContributor.emberSession.messages,
            }
          : null,
        latestVoiceCall: refreshedContributor.voiceCalls[0] ?? null,
        wiki: refreshedContributor.ember.wiki,
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
