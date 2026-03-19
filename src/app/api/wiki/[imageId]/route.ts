import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess, getImageAccessType } from '@/lib/ember-access';
import { ensureOwnerContributorForImage } from '@/lib/owner-contributor';
import { refreshVoiceCallFromProvider, shouldRefreshVoiceCallStatus } from '@/lib/voice-calls';

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
    const accessType = await getImageAccessType(auth.user.id, imageId);

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

    let ownerConversationTarget =
      accessType === 'owner'
        ? await prisma.contributor.findFirst({
            where: {
              imageId,
              userId: auth.user.id,
            },
            select: {
              id: true,
              token: true,
              phoneNumber: true,
              user: {
                select: {
                  phoneNumber: true,
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
          })
        : null;

    const latestVoiceCall = ownerConversationTarget?.voiceCalls[0] || null;
    if (latestVoiceCall && shouldRefreshVoiceCallStatus(latestVoiceCall)) {
      try {
        await refreshVoiceCallFromProvider(latestVoiceCall.id);
        ownerConversationTarget = await prisma.contributor.findFirst({
          where: {
            imageId,
            userId: auth.user.id,
          },
          select: {
            id: true,
            token: true,
            phoneNumber: true,
            user: {
              select: {
                phoneNumber: true,
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
      } catch (refreshError) {
        console.error('Failed to refresh owner wiki voice call from provider:', refreshError);
      }
    }

    return NextResponse.json({
      ...wiki,
      canManage: accessType === 'owner',
      ownerConversationTarget: ownerConversationTarget
        ? {
            id: ownerConversationTarget.id,
            token: ownerConversationTarget.token,
            phoneNumber: ownerConversationTarget.phoneNumber,
            phoneAvailable: Boolean(
              ownerConversationTarget.phoneNumber || ownerConversationTarget.user?.phoneNumber
            ),
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
    const image = await ensureImageOwnerAccess(auth.user.id, imageId);

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
