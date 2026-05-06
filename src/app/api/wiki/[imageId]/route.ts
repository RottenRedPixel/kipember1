import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess, getEmberAccessType } from '@/lib/ember';
import { ensureOwnerContributorForImage } from '@/lib/owner-contributor';
import { refreshVoiceCallFromProvider, shouldRefreshVoiceCallStatus } from '@/lib/voice-calls';
import { getUserDisplayName } from '@/lib/user-name';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageId } = await params;
    const accessType = await getEmberAccessType(auth.user.id, imageId);

    if (!accessType) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    if (accessType === 'owner') {
      await ensureOwnerContributorForImage(imageId, auth.user.id);
    }

    const wiki = await prisma.wiki.findUnique({
      where: { imageId },
      include: {
        image: {
          select: {
            originalName: true,
            title: true,
            description: true,
            filename: true,
            mediaType: true,
            posterFilename: true,
            durationSeconds: true,
            attachments: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                filename: true,
                mediaType: true,
                posterFilename: true,
                durationSeconds: true,
                originalName: true,
                description: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!wiki) {
      return NextResponse.json({ error: 'Wiki not found' }, { status: 404 });
    }

    const ownerEcInclude = {
      id: true,
      token: true,
      user: {
        select: {
          phoneNumber: true,
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

    let ownerConversationTarget =
      accessType === 'owner'
        ? await prisma.emberContributor.findFirst({
            where: {
              imageId,
              userId: auth.user.id,
            },
            select: ownerEcInclude,
          })
        : null;

    const latestVoiceCall = ownerConversationTarget?.voiceCalls[0] || null;
    if (latestVoiceCall && shouldRefreshVoiceCallStatus(latestVoiceCall)) {
      try {
        await refreshVoiceCallFromProvider(latestVoiceCall.id);
        ownerConversationTarget = await prisma.emberContributor.findFirst({
          where: {
            imageId,
            userId: auth.user.id,
          },
          select: ownerEcInclude,
        });
      } catch (refreshError) {
        console.error('Failed to refresh owner wiki voice call from provider:', refreshError);
      }
    }

    let voiceCallClips: Array<{
      id: string;
      title: string;
      quote: string;
      significance: string | null;
      audioUrl: string | null;
      startMs: number | null;
      endMs: number | null;
      createdAt: Date;
      contributorName: string;
    }> = [];

    try {
      const clips = await prisma.voiceCallClip.findMany({
        where: { imageId },
        orderBy: [{ createdAt: 'asc' }, { sortOrder: 'asc' }],
        select: {
          id: true,
          title: true,
          quote: true,
          significance: true,
          audioUrl: true,
          startMs: true,
          endMs: true,
          createdAt: true,
          emberContributor: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  phoneNumber: true,
                },
              },
            },
          },
        },
      });

      voiceCallClips = clips.map((clip) => {
        const u = clip.emberContributor.user;
        return {
          id: clip.id,
          title: clip.title,
          quote: clip.quote,
          significance: clip.significance,
          audioUrl: clip.audioUrl,
          startMs: clip.startMs,
          endMs: clip.endMs,
          createdAt: clip.createdAt,
          contributorName:
            getUserDisplayName(u) ||
            u?.email ||
            u?.phoneNumber ||
            'Contributor',
        };
      });
    } catch (voiceClipError) {
      console.error('Error loading wiki voice call clips:', voiceClipError);
    }

    return NextResponse.json({
      ...wiki,
      voiceCallClips,
      canManage: accessType === 'owner',
      ownerConversationTarget: ownerConversationTarget
        ? {
            id: ownerConversationTarget.id,
            token: ownerConversationTarget.token,
            phoneNumber: ownerConversationTarget.user?.phoneNumber ?? null,
            phoneAvailable: Boolean(ownerConversationTarget.user?.phoneNumber),
            latestVoiceCall: ownerConversationTarget.voiceCalls[0] || null,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching wiki:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wiki' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageId } = await params;
    const image = await ensureEmberOwnerAccess(auth.user.id, imageId);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const content = await generateWikiForImage(imageId);

    return NextResponse.json({ success: true, content });
  } catch (error) {
    console.error('Error generating wiki:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate wiki' },
      { status: 500 }
    );
  }
}
