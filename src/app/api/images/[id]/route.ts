import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, normalizePhone, requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess, getAcceptedFriends, getImageAccessType } from '@/lib/ember-access';
import { prisma } from '@/lib/db';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';
import { ensureOwnerContributorForImage } from '@/lib/owner-contributor';
import { refreshVoiceCallFromProvider, shouldRefreshVoiceCallStatus } from '@/lib/voice-calls';

function normalizeLabelKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const accessType = await getImageAccessType(auth.user.id, id);

    if (!accessType) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    if (accessType === 'owner') {
      await ensureOwnerContributorForImage(id, auth.user.id);
    }

    const loadImage = () =>
      prisma.image.findUnique({
        where: { id },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          contributors: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phoneNumber: true,
                },
              },
              conversation: {
                select: {
                  status: true,
                  currentStep: true,
                  messages: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                      id: true,
                      role: true,
                      content: true,
                      source: true,
                      createdAt: true,
                    },
                  },
                  responses: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                      id: true,
                      questionType: true,
                      question: true,
                      answer: true,
                      source: true,
                      createdAt: true,
                    },
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
                  initiatedBy: true,
                  memorySyncedAt: true,
                },
              },
            },
          },
          analysis: {
            select: {
              status: true,
              summary: true,
              visualDescription: true,
              metadataSummary: true,
              capturedAt: true,
              latitude: true,
              longitude: true,
              cameraMake: true,
              cameraModel: true,
              lensModel: true,
              metadataJson: true,
              updatedAt: true,
            },
          },
          tags: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phoneNumber: true,
                },
              },
              contributor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phoneNumber: true,
                  inviteSent: true,
                },
              },
            },
          },
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
          wiki: {
            select: {
              id: true,
              content: true,
              version: true,
              updatedAt: true,
            },
          },
          storyCut: {
            select: {
              id: true,
              title: true,
              style: true,
              focus: true,
              durationSeconds: true,
              wordCount: true,
              script: true,
              blocksJson: true,
              metadataJson: true,
              selectedMediaJson: true,
              selectedContributorJson: true,
              includeOwner: true,
              includeEmberVoice: true,
              includeNarratorVoice: true,
              emberVoiceId: true,
              emberVoiceLabel: true,
              narratorVoiceId: true,
              narratorVoiceLabel: true,
              updatedAt: true,
            },
          },
          sportsMode: {
            select: {
              id: true,
              sportType: true,
              subjectName: true,
              finalScore: true,
              outcome: true,
              updatedAt: true,
            },
          },
        },
      });

    const loadVoiceCallClips = async () => {
      try {
        return await prisma.voiceCallClip.findMany({
          where: { imageId: id },
          orderBy: [{ createdAt: 'asc' }, { sortOrder: 'asc' }],
          select: {
            id: true,
            voiceCallId: true,
            contributorId: true,
            title: true,
            quote: true,
            significance: true,
            speaker: true,
            audioUrl: true,
            startMs: true,
            endMs: true,
            canUseForTitle: true,
            createdAt: true,
            contributor: {
              select: {
                id: true,
                userId: true,
                name: true,
                email: true,
                phoneNumber: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        });
      } catch (voiceClipError) {
        console.error('Failed to load voice call clips for image payload:', voiceClipError);
        return [];
      }
    };

    let image = await loadImage();

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    if (accessType === 'owner') {
      const ownerContributor = image.contributors.find(
        (contributor) => contributor.userId === auth.user.id
      );
      const latestVoiceCall = ownerContributor?.voiceCalls[0] || null;

      if (latestVoiceCall && shouldRefreshVoiceCallStatus(latestVoiceCall)) {
        try {
          await refreshVoiceCallFromProvider(latestVoiceCall.id);
          image = await loadImage();
        } catch (refreshError) {
          console.error('Failed to refresh owner voice call from provider:', refreshError);
        }
      }
    }

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const friends = accessType === 'owner' ? await getAcceptedFriends(auth.user.id) : [];
    const viewerContributor =
      image.contributors.find((contributor) => contributor.userId === auth.user.id) || null;
    const tagIdentityMap = new Map<
      string,
      {
        id: string;
        label: string;
        email: string;
        phoneNumber: string;
        userId: string | null;
        contributorId: string | null;
      }
    >();

    if (accessType === 'owner') {
      const priorTagIdentities = await prisma.imageTag.findMany({
        where: {
          imageId: { not: id },
          image: {
            ownerId: auth.user.id,
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
            },
          },
          contributor: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      });

      for (const tag of priorTagIdentities) {
        const label =
          tag.user?.name ||
          tag.contributor?.name ||
          tag.label.trim();

        if (!label) {
          continue;
        }

        const email =
          tag.user?.email ||
          tag.contributor?.email ||
          tag.email ||
          '';
        const phoneNumber =
          tag.user?.phoneNumber ||
          tag.contributor?.phoneNumber ||
          tag.phoneNumber ||
          '';
        const key =
          (tag.userId ? `user:${tag.userId}` : null) ||
          (tag.contributorId ? `contributor:${tag.contributorId}` : null) ||
          (email ? `email:${normalizeEmail(email)}` : null) ||
          (phoneNumber ? `phone:${normalizePhone(phoneNumber)}` : null) ||
          `label:${normalizeLabelKey(label)}`;

        if (tagIdentityMap.has(key)) {
          continue;
        }

        tagIdentityMap.set(key, {
          id: key,
          label,
          email,
          phoneNumber,
          userId: tag.userId,
          contributorId: tag.contributorId,
        });
      }
    }

    const voiceCallClips = await loadVoiceCallClips();

    return NextResponse.json({
      id: image.id,
      filename: image.filename,
      mediaType: image.mediaType,
      posterFilename: image.posterFilename,
      durationSeconds: image.durationSeconds,
      originalName: image.originalName,
      title: image.title,
      description: image.description,
      createdAt: image.createdAt,
      shareToNetwork: image.shareToNetwork,
      owner: image.owner,
      accessType,
      canManage: accessType === 'owner',
      currentUserId: auth.user.id,
      viewerContributorId: viewerContributor?.id || null,
      viewerCanLeave: accessType === 'contributor' && Boolean(viewerContributor),
      contributors: image.contributors,
      ownerConversationTarget:
        accessType === 'owner'
          ? image.contributors.find((contributor) => contributor.userId === auth.user.id) || null
          : null,
      attachments: image.attachments,
      tags: image.tags,
      friends,
      tagIdentities: Array.from(tagIdentityMap.values()).slice(0, 12),
      analysis: image.analysis
        ? {
            ...image.analysis,
            confirmedLocation: parseConfirmedLocationContext(image.analysis.metadataJson),
          }
        : null,
      voiceCallClips: voiceCallClips.map((clip) => ({
        id: clip.id,
        voiceCallId: clip.voiceCallId,
        contributorId: clip.contributorId,
        contributorUserId: clip.contributor.user?.id || clip.contributor.userId || null,
        contributorName:
          clip.contributor.name ||
          clip.contributor.user?.name ||
          clip.contributor.email ||
          clip.contributor.phoneNumber ||
          'Contributor',
        title: clip.title,
        quote: clip.quote,
        significance: clip.significance,
        speaker: clip.speaker,
        audioUrl: clip.audioUrl,
        startMs: clip.startMs,
        endMs: clip.endMs,
        canUseForTitle: clip.canUseForTitle,
        createdAt: clip.createdAt,
      })),
      wiki: image.wiki,
      storyCut: image.storyCut
        ? {
            ...image.storyCut,
            blocks: safeParseJson(image.storyCut.blocksJson, []),
            metadata: safeParseJson(image.storyCut.metadataJson, null),
            selectedMediaIds: safeParseJson(image.storyCut.selectedMediaJson, []),
            selectedContributorIds: safeParseJson(image.storyCut.selectedContributorJson, []),
          }
        : null,
      sportsMode: image.sportsMode,
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    return NextResponse.json(
      { error: 'Failed to load image' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const ownedImage = await ensureImageOwnerAccess(auth.user.id, id);

    if (!ownedImage) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    await prisma.image.delete({
      where: { id: ownedImage.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const ownedImage = await ensureImageOwnerAccess(auth.user.id, id);

    if (!ownedImage) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await request.json();

    const updateData: {
      shareToNetwork?: boolean;
      title?: string | null;
      description?: string | null;
    } = {};
    let capturedAtValue: Date | null | undefined;

    if (typeof body?.shareToNetwork === 'boolean') {
      updateData.shareToNetwork = body.shareToNetwork;
    }

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'title')) {
      if (body.title !== null && typeof body.title !== 'string') {
        return NextResponse.json(
          { error: 'title must be a string or null' },
          { status: 400 }
        );
      }

      updateData.title = typeof body.title === 'string' ? body.title.trim() || null : null;
    }

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'description')) {
      if (body.description !== null && typeof body.description !== 'string') {
        return NextResponse.json(
          { error: 'description must be a string or null' },
          { status: 400 }
        );
      }

      updateData.description =
        typeof body.description === 'string' ? body.description.trim() || null : null;
    }

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'capturedAt')) {
      if (body.capturedAt !== null && typeof body.capturedAt !== 'string') {
        return NextResponse.json(
          { error: 'capturedAt must be a string or null' },
          { status: 400 }
        );
      }

      if (typeof body.capturedAt === 'string') {
        const parsedDate = new Date(body.capturedAt);
        if (Number.isNaN(parsedDate.getTime())) {
          return NextResponse.json(
            { error: 'capturedAt must be a valid ISO date string' },
            { status: 400 }
          );
        }

        capturedAtValue = parsedDate;
      } else {
        capturedAtValue = null;
      }
    }

    if (Object.keys(updateData).length === 0 && capturedAtValue === undefined) {
      return NextResponse.json(
        { error: 'No valid image fields were provided' },
        { status: 400 }
      );
    }

    const image = await prisma.image.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        shareToNetwork: true,
        title: true,
        description: true,
      },
    });

    if (capturedAtValue !== undefined) {
      await prisma.imageAnalysis.upsert({
        where: { imageId: id },
        update: {
          capturedAt: capturedAtValue,
        },
        create: {
          imageId: id,
          status: 'partial',
          capturedAt: capturedAtValue,
        },
      });
    }

    return NextResponse.json(image);
  } catch (error) {
    console.error('Error updating image:', error);
    return NextResponse.json(
      { error: 'Failed to update image' },
      { status: 500 }
    );
  }
}
