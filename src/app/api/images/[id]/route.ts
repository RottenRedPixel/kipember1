import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, normalizePhone, requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess, getAcceptedFriends, getEmberAccessType } from '@/lib/ember';
import { prisma } from '@/lib/db';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';
import { ensureOwnerContributorForImage } from '@/lib/owner-contributor';
import { refreshVoiceCallFromProvider, shouldRefreshVoiceCallStatus } from '@/lib/voice-calls';
import { parseVoiceCallTranscriptSegments } from '@/lib/voice-call-clips';
import { invalidateAccessibleEmbersForUser } from '@/lib/ember';
import { toTitleCase } from '@/lib/ember-title';
import { getUserDisplayName } from '@/lib/user-name';

function normalizeLabelKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseNoContributors(metadataJson: string | null | undefined): boolean {
  if (!metadataJson) return false;
  try {
    const parsed = JSON.parse(metadataJson) as Record<string, unknown>;
    return parsed?.noContributors === true;
  } catch {
    return false;
  }
}

function mergeNoContributors(metadataJson: string | null | undefined, value: boolean): string {
  let parsed: Record<string, unknown> = {};
  if (metadataJson) {
    try { parsed = JSON.parse(metadataJson) as Record<string, unknown>; } catch { /* keep empty */ }
  }
  if (value) {
    parsed.noContributors = true;
  } else {
    delete parsed.noContributors;
  }
  return JSON.stringify(parsed);
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
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const accessType = await getEmberAccessType(auth.user.id, id);
    const scope = request.nextUrl.searchParams.get('scope');

    if (!accessType) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    if (scope === 'play') {
      const image = await prisma.image.findUnique({
        where: { id },
        select: {
          id: true,
          filename: true,
          mediaType: true,
          posterFilename: true,
          durationSeconds: true,
          originalName: true,
          title: true,
          description: true,
          createdAt: true,
          shareToNetwork: true,
          keepPrivate: true,
          cropX: true,
          cropY: true,
          cropWidth: true,
          cropHeight: true,
          analysis: {
            select: {
              summary: true,
              capturedAt: true,
            },
          },
          wiki: {
            select: {
              content: true,
              version: true,
              updatedAt: true,
            },
          },
          snapshot: {
            select: {
              script: true,
            },
          },
        },
      });

      if (!image) {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 });
      }

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
        keepPrivate: image.keepPrivate,
        cropX: image.cropX ?? null,
        cropY: image.cropY ?? null,
        cropWidth: image.cropWidth ?? null,
        cropHeight: image.cropHeight ?? null,
        accessType,
        canManage: accessType === 'owner',
        analysis: image.analysis,
        wiki: image.wiki,
        snapshot: image.snapshot,
      });
    }

    if (scope === 'contributors') {
      const loadContributorImage = () =>
        prisma.image.findUnique({
          where: { id },
          select: {
            id: true,
            filename: true,
            mediaType: true,
            posterFilename: true,
            durationSeconds: true,
            originalName: true,
            title: true,
            description: true,
            createdAt: true,
            shareToNetwork: true,
            keepPrivate: true,
          cropX: true,
          cropY: true,
          cropWidth: true,
          cropHeight: true,
            analysis: {
              select: {
                metadataJson: true,
              },
            },
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                createdAt: true,
              },
            },
            emberContributors: {
              orderBy: { createdAt: 'asc' },
              include: {
                contributor: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phoneNumber: true,
                      },
                    },
                  },
                },
                emberSession: {
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
                        question: true,
                        questionType: true,
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
          },
        });

      let image = await loadContributorImage();

      if (!image) {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 });
      }

      if (accessType === 'owner') {
        const ownerContributorExists = image.emberContributors.some(
          (ec) => ec.contributor.userId === auth.user.id
        );

        if (!ownerContributorExists) {
          await ensureOwnerContributorForImage(id, auth.user.id);
          image = await loadContributorImage();
        }
      }

      if (!image) {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 });
      }

      const viewerContributor =
        image.emberContributors.find((ec) => ec.contributor.userId === auth.user.id) || null;

      // Flatten EmberContributors into the legacy contributor shape for the
      // client. `id` is the EmberContributor.id (per-ember row), pool fields
      // hoisted to the top level.
      const flattenedContributors = image.emberContributors.map((ec) => ({
        id: ec.id,
        token: ec.token,
        inviteSent: ec.inviteSent,
        createdAt: ec.createdAt,
        imageId: ec.imageId,
        userId: ec.contributor.userId,
        name: ec.contributor.name,
        email: ec.contributor.email,
        phoneNumber: ec.contributor.phoneNumber,
        user: ec.contributor.user,
        emberSession: ec.emberSession,
        voiceCalls: ec.voiceCalls,
      }));

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
        keepPrivate: image.keepPrivate,
        owner: image.owner,
        accessType,
        canManage: accessType === 'owner',
        currentUserId: auth.user.id,
        viewerContributorId: viewerContributor?.id || null,
        viewerCanLeave: accessType === 'contributor' && Boolean(viewerContributor),
        contributors: flattenedContributors,
        ownerConversationTarget:
          accessType === 'owner'
            ? flattenedContributors.find((c) => c.userId === auth.user.id) || null
            : null,
        attachments: [],
        tags: [],
        friends: [],
        tagIdentities: [],
        analysis: image.analysis
          ? { noContributors: parseNoContributors(image.analysis.metadataJson) }
          : null,
        voiceCallClips: [],
        wiki: null,
        snapshot: null,
      });
    }

    const loadImage = () =>
      prisma.image.findUnique({
        where: { id },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarFilename: true,
              createdAt: true,
            },
          },
          emberContributors: {
            orderBy: { createdAt: 'asc' },
            include: {
              contributor: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      phoneNumber: true,
                      avatarFilename: true,
                    },
                  },
                },
              },
              emberSession: {
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
                      question: true,
                      questionType: true,
                      createdAt: true,
                    },
                  },
                },
              },
              voiceCalls: {
                orderBy: { createdAt: 'desc' },
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
                  recordingUrl: true,
                  transcriptObjectJson: true,
                  transcript: true,
                  emberSession: {
                    select: {
                      id: true,
                      messages: {
                        orderBy: { createdAt: 'asc' },
                        select: {
                          id: true,
                          role: true,
                          content: true,
                          source: true,
                          question: true,
                          questionType: true,
                          createdAt: true,
                        },
                      },
                    },
                  },
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
              mood: true,
              peopleJson: true,
              placesJson: true,
              thingsJson: true,
              activitiesJson: true,
              visibleTextJson: true,
              openQuestionsJson: true,
              sceneInsightsJson: true,
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
                  firstName: true,
                  lastName: true,
                  email: true,
                  phoneNumber: true,
                },
              },
              emberContributor: {
                select: {
                  id: true,
                  inviteSent: true,
                  contributor: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      phoneNumber: true,
                    },
                  },
                },
              },
              createdByUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatarFilename: true,
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
              analysisText: true,
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
          snapshot: {
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
            emberContributorId: true,
            title: true,
            quote: true,
            significance: true,
            speaker: true,
            audioUrl: true,
            startMs: true,
            endMs: true,
            canUseForTitle: true,
            createdAt: true,
            emberContributor: {
              select: {
                id: true,
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
                        firstName: true,
                        lastName: true,
                        email: true,
                      },
                    },
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
      const ownerContributorExists = image.emberContributors.some(
        (ec) => ec.contributor.userId === auth.user.id
      );

      if (!ownerContributorExists) {
        await ensureOwnerContributorForImage(id, auth.user.id);
        image = await loadImage();
      }

      if (!image) {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 });
      }

      const ownerContributor = image.emberContributors.find(
        (ec) => ec.contributor.userId === auth.user.id
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
      image.emberContributors.find((ec) => ec.contributor.userId === auth.user.id) || null;
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
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
          emberContributor: {
            select: {
              id: true,
              contributor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phoneNumber: true,
                },
              },
            },
          },
        },
      });

      for (const tag of priorTagIdentities) {
        const tagContributor = tag.emberContributor?.contributor ?? null;
        const label =
          getUserDisplayName(tag.user) ||
          tagContributor?.name ||
          tag.label.trim();

        if (!label) {
          continue;
        }

        const email =
          tag.user?.email ||
          tagContributor?.email ||
          tag.email ||
          '';
        const phoneNumber =
          tag.user?.phoneNumber ||
          tagContributor?.phoneNumber ||
          tag.phoneNumber ||
          '';
        const key =
          (tag.userId ? `user:${tag.userId}` : null) ||
          (tag.emberContributorId ? `contributor:${tag.emberContributorId}` : null) ||
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
          contributorId: tag.emberContributorId,
        });
      }
    }

    const voiceCallClips = await loadVoiceCallClips();

    // Build chatBlocks: one block per person, merging their chat + call sessions.
    // Only authentic messages (typed or transcribed); synthetic AI-extracted rows
    // (questionType !== null) are excluded.
    type PersonIdentity = {
      userId: string | null;
      email: string | null;
      phoneNumber: string | null;
    };
    let chatBlocks: Array<{
      personName: string;
      avatarUrl: string | null;
      isOwner: boolean;
      personUserId: string | null;
      personEmail: string | null;
      personPhoneNumber: string | null;
      messages: Array<{
        role: string;
        content: string;
        source: string;
        imageFilename?: string | null;
        audioUrl?: string | null;
        createdAt: string;
      }>;
    }> = [];
    let voiceBlocks: Array<{
      personName: string;
      avatarUrl: string | null;
      isOwner: boolean;
      personUserId: string | null;
      personEmail: string | null;
      personPhoneNumber: string | null;
      messages: Array<{
        role: string;
        content: string;
        audioUrl: string | null;
        createdAt: string;
      }>;
    }> = [];
    // Each anonymous share-link browser is identified by its
    // kb-guest-browser cookie, which the chat + voice routes both write
    // into EmberSession.participantId. A single visitor therefore has up
    // to two rows (one chat session, one voice session) sharing the same
    // participantId — so we bucket per participantId, not per session.id,
    // to keep a visitor's chat and voice timelines together.
    type GuestVisitorBucket = {
      visitorId: string;
      firstMessageAt: string;
      chatMessages: Array<{
        role: string;
        content: string;
        source: string;
        imageFilename?: string | null;
        audioUrl?: string | null;
        createdAt: string;
      }>;
      voiceMessages: Array<{
        role: string;
        content: string;
        audioUrl: string | null;
        createdAt: string;
      }>;
    };
    let guestVisitors = new Map<string, GuestVisitorBucket>();
    try {
      const emberSessions = await prisma.emberSession.findMany({
        where: { imageId: id, sessionType: { in: ['chat', 'call', 'voice'] } },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, avatarFilename: true } },
          emberContributor: {
            select: {
              id: true,
              contributor: { select: { id: true, userId: true, name: true, email: true, phoneNumber: true } },
            },
          },
          messages: { orderBy: { createdAt: 'asc' } },
        },
      });

      type ChatMessage = {
        role: string;
        content: string;
        source: string;
        imageFilename?: string | null;
        audioUrl?: string | null;
        createdAt: string;
      };
      type VoiceTurn = {
        role: string;
        content: string;
        audioUrl: string | null;
        createdAt: string;
      };
      type PersonBucket = {
        personName: string;
        avatarUrl: string | null;
        isOwner: boolean;
        identity: PersonIdentity;
        chatMessages: ChatMessage[];
        voiceMessages: VoiceTurn[];
      };
      const byPerson = new Map<string, PersonBucket>();
      // Guest sessions are bucketed per-visitor (participantId =
      // kb-guest-browser cookie) so each anonymous visitor's chat AND
      // voice timelines collapse into a single visitor card on the
      // wiki. Voice sessions are routed to bucket.voiceMessages with
      // audioUrl resolved from EmberMessage.audioFilename, mirroring
      // /api/voice's GET shape.
      for (const session of emberSessions) {
        if (session.participantType === 'guest') {
          const visitorId = session.participantId;
          let bucket = guestVisitors.get(visitorId);
          if (!bucket) {
            bucket = {
              visitorId,
              firstMessageAt: '',
              chatMessages: [],
              voiceMessages: [],
            };
            guestVisitors.set(visitorId, bucket);
          }
          const isVoice = session.sessionType === 'voice';
          for (const msg of session.messages) {
            if (msg.questionType) continue;
            if (isVoice) {
              bucket.voiceMessages.push({
                role: msg.role,
                content: msg.content,
                audioUrl: msg.audioFilename ? `/api/uploads/${msg.audioFilename}` : null,
                createdAt: msg.createdAt.toISOString(),
              });
            } else {
              // Chat-session messages with source 'voice' are stray; skip
              // them so they don't double up with the dedicated voice bucket.
              if (msg.source === 'voice') continue;
              bucket.chatMessages.push({
                role: msg.role,
                content: msg.content,
                source: msg.source || 'web',
                imageFilename: msg.imageFilename ?? null,
                audioUrl: null as string | null,
                createdAt: msg.createdAt.toISOString(),
              });
            }
          }
          continue;
        }
        const sessionContributor = session.emberContributor?.contributor ?? null;
        const personName =
          getUserDisplayName(session.user) ||
          sessionContributor?.name ||
          session.user?.email ||
          sessionContributor?.email ||
          'Contributor';
        const personKey =
          session.userId ||
          session.emberContributorId ||
          session.participantId ||
          personName;
        const avatarUrl = session.user?.avatarFilename ? `/api/uploads/${session.user.avatarFilename}` : null;
        const isOwner = session.userId === image.ownerId;
        const identity: PersonIdentity = {
          userId: session.user?.id ?? sessionContributor?.userId ?? null,
          email: session.user?.email ?? sessionContributor?.email ?? null,
          phoneNumber: sessionContributor?.phoneNumber ?? null,
        };
        const bucket =
          byPerson.get(personKey) || {
            personName,
            avatarUrl,
            isOwner,
            identity,
            chatMessages: [],
            voiceMessages: [],
          };
        for (const msg of session.messages) {
          if (msg.questionType) continue;
          if (msg.source === 'voice' || session.sessionType === 'voice') {
            bucket.voiceMessages.push({
              role: msg.role,
              content: msg.content,
              audioUrl: msg.audioFilename ? `/api/uploads/${msg.audioFilename}` : null,
              createdAt: msg.createdAt.toISOString(),
            });
          } else {
            bucket.chatMessages.push({
              role: msg.role,
              content: msg.content,
              source: msg.source || 'web',
              imageFilename: msg.imageFilename ?? null,
              audioUrl: null as string | null,
              createdAt: msg.createdAt.toISOString(),
            });
          }
        }
        byPerson.set(personKey, bucket);
      }

      // Dedup identical (role, content) within each person and sort by time.
      const buckets = Array.from(byPerson.values());
      chatBlocks = buckets
        .map((bucket) => {
          const seen = new Set<string>();
          const deduped = bucket.chatMessages
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .filter((m) => {
              const key = `${m.role}::${m.content.replace(/\s+/g, ' ').trim()}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          return {
            personName: bucket.personName,
            avatarUrl: bucket.avatarUrl,
            isOwner: bucket.isOwner,
            personUserId: bucket.identity.userId,
            personEmail: bucket.identity.email,
            personPhoneNumber: bucket.identity.phoneNumber,
            messages: deduped,
          };
        })
        .filter((block) => block.messages.length > 0);

      voiceBlocks = buckets
        .map((bucket) => ({
          personName: bucket.personName,
          avatarUrl: bucket.avatarUrl,
          isOwner: bucket.isOwner,
          personUserId: bucket.identity.userId,
          personEmail: bucket.identity.email,
          personPhoneNumber: bucket.identity.phoneNumber,
          messages: bucket.voiceMessages.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),
        }))
        .filter((block) => block.messages.length > 0);
    } catch (chatBlocksError) {
      console.error('Failed to load chatBlocks:', chatBlocksError);
      chatBlocks = [];
      voiceBlocks = [];
      guestVisitors = new Map();
    }

    // Build callBlocks: one block per Retell voice call, with parsed per-turn segments.
    // Audio play buttons activate post-call once recordingUrl + transcriptObjectJson land.
    let callBlocks: Array<{
      personName: string;
      avatarUrl: string | null;
      personUserId: string | null;
      personEmail: string | null;
      personPhoneNumber: string | null;
      voiceCallId: string;
      recordingUrl: string | null;
      startedAt: string | null;
      endedAt: string | null;
      status: string;
      segments: Array<{
        index: number;
        role: string;
        speaker: string;
        content: string;
        startMs: number | null;
        endMs: number | null;
      }>;
    }> = [];
    try {
      for (const ec of image.emberContributors) {
        const personName =
          ec.contributor.name ||
          getUserDisplayName(ec.contributor.user) ||
          ec.contributor.email ||
          ec.contributor.phoneNumber ||
          'Contributor';
        const avatarUrl = ec.contributor.user?.avatarFilename
          ? `/api/uploads/${ec.contributor.user.avatarFilename}`
          : null;
        for (const voiceCall of ec.voiceCalls) {
          const segments = parseVoiceCallTranscriptSegments({
            transcript: voiceCall.transcript ?? null,
            transcriptObjectJson: voiceCall.transcriptObjectJson ?? null,
            contributorName: personName,
          });
          if (segments.length === 0) continue;
          callBlocks.push({
            personName,
            avatarUrl,
            personUserId: ec.contributor.user?.id ?? ec.contributor.userId ?? null,
            personEmail: ec.contributor.email ?? ec.contributor.user?.email ?? null,
            personPhoneNumber: ec.contributor.phoneNumber ?? null,
            voiceCallId: voiceCall.id,
            recordingUrl: voiceCall.recordingUrl ?? null,
            startedAt: voiceCall.startedAt ? voiceCall.startedAt.toISOString() : null,
            endedAt: voiceCall.endedAt ? voiceCall.endedAt.toISOString() : null,
            status: voiceCall.status,
            segments: segments.map((segment) => ({
              index: segment.index,
              role: segment.role,
              speaker: segment.speaker,
              content: segment.content,
              startMs: segment.startMs,
              endMs: segment.endMs,
            })),
          });
        }
      }
    } catch (callBlocksError) {
      console.error('Failed to load callBlocks:', callBlocksError);
      callBlocks = [];
    }

    return NextResponse.json({
      id: image.id,
      filename: image.filename,
      mediaType: image.mediaType,
      posterFilename: image.posterFilename,
      durationSeconds: image.durationSeconds,
      originalName: image.originalName,
      title: image.title,
      titleUpdatedAt: image.titleUpdatedAt ?? null,
      description: image.description,
      createdAt: image.createdAt,
      shareToNetwork: image.shareToNetwork,
      keepPrivate: image.keepPrivate,
      cropX: image.cropX ?? null,
      cropY: image.cropY ?? null,
      cropWidth: image.cropWidth ?? null,
      cropHeight: image.cropHeight ?? null,
      owner: image.owner,
      accessType,
      canManage: accessType === 'owner',
      currentUserId: auth.user.id,
      viewerContributorId: viewerContributor?.id || null,
      viewerCanLeave: accessType === 'contributor' && Boolean(viewerContributor),
      contributors: image.emberContributors.map((ec) => ({
        id: ec.id,
        token: ec.token,
        inviteSent: ec.inviteSent,
        createdAt: ec.createdAt,
        imageId: ec.imageId,
        userId: ec.contributor.userId,
        name: ec.contributor.name,
        email: ec.contributor.email,
        phoneNumber: ec.contributor.phoneNumber,
        user: ec.contributor.user,
        emberSession: ec.emberSession,
        voiceCalls: ec.voiceCalls,
      })),
      ownerConversationTarget:
        accessType === 'owner'
          ? (() => {
              const ec = image.emberContributors.find(
                (e) => e.contributor.userId === auth.user.id
              );
              if (!ec) return null;
              return {
                id: ec.id,
                token: ec.token,
                inviteSent: ec.inviteSent,
                createdAt: ec.createdAt,
                imageId: ec.imageId,
                userId: ec.contributor.userId,
                name: ec.contributor.name,
                email: ec.contributor.email,
                phoneNumber: ec.contributor.phoneNumber,
                user: ec.contributor.user,
                emberSession: ec.emberSession,
                voiceCalls: ec.voiceCalls,
              };
            })()
          : null,
      attachments: image.attachments,
      tags: image.tags.map((tag) => ({
        ...tag,
        createdBy: tag.createdByUser
          ? {
              id: tag.createdByUser.id,
              firstName: tag.createdByUser.firstName,
              lastName: tag.createdByUser.lastName,
              email: tag.createdByUser.email,
              avatarUrl: tag.createdByUser.avatarFilename
                ? `/api/uploads/${tag.createdByUser.avatarFilename}`
                : null,
            }
          : null,
      })),
      friends,
      tagIdentities: Array.from(tagIdentityMap.values()).slice(0, 12),
      analysis: image.analysis
        ? {
            ...image.analysis,
            peopleObserved: safeParseJson(image.analysis.peopleJson, []),
            placeSignals: safeParseJson(image.analysis.placesJson, []),
            notableThings: safeParseJson(image.analysis.thingsJson, []),
            activities: safeParseJson(image.analysis.activitiesJson, []),
            visibleText: safeParseJson(image.analysis.visibleTextJson, []),
            openQuestions: safeParseJson(image.analysis.openQuestionsJson, []),
            sceneInsights: safeParseJson(image.analysis.sceneInsightsJson, null),
            confirmedLocation: parseConfirmedLocationContext(image.analysis.metadataJson),
            noContributors: parseNoContributors(image.analysis.metadataJson),
          }
        : null,
      voiceCallClips: voiceCallClips.map((clip) => ({
        id: clip.id,
        voiceCallId: clip.voiceCallId,
        contributorId: clip.emberContributorId,
        contributorUserId:
          clip.emberContributor.contributor.user?.id ||
          clip.emberContributor.contributor.userId ||
          null,
        contributorName:
          clip.emberContributor.contributor.name ||
          getUserDisplayName(clip.emberContributor.contributor.user) ||
          clip.emberContributor.contributor.email ||
          clip.emberContributor.contributor.phoneNumber ||
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
      snapshot: image.snapshot
        ? {
            ...image.snapshot,
            blocks: safeParseJson(image.snapshot.blocksJson, []),
            metadata: safeParseJson(image.snapshot.metadataJson, null),
            selectedMediaIds: safeParseJson(image.snapshot.selectedMediaJson, []),
            selectedContributorIds: safeParseJson(image.snapshot.selectedContributorJson, []),
          }
        : null,
      chatBlocks,
      voiceBlocks,
      callBlocks,
      guestChatBlock: (() => {
        // Drop empty buckets (a visitor row with both timelines empty
        // can happen if a session was created but never wrote messages),
        // sort each visitor's two timelines, then order visitors by their
        // earliest message across either timeline.
        const finalized = Array.from(guestVisitors.values())
          .map((bucket) => {
            bucket.chatMessages.sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            bucket.voiceMessages.sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            const candidates = [
              bucket.chatMessages[0]?.createdAt,
              bucket.voiceMessages[0]?.createdAt,
            ].filter((value): value is string => Boolean(value));
            bucket.firstMessageAt = candidates.length
              ? candidates.reduce((earliest, current) =>
                  new Date(current).getTime() < new Date(earliest).getTime() ? current : earliest
                )
              : '';
            return bucket;
          })
          .filter((bucket) => bucket.chatMessages.length > 0 || bucket.voiceMessages.length > 0)
          .sort(
            (a, b) =>
              new Date(a.firstMessageAt).getTime() - new Date(b.firstMessageAt).getTime()
          );
        return finalized.length > 0
          ? { visitors: finalized, sessionCount: finalized.length }
          : null;
      })(),
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
    const ownedImage = await ensureEmberOwnerAccess(auth.user.id, id);

    if (!ownedImage) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    await prisma.image.delete({
      where: { id: ownedImage.id },
    });
    invalidateAccessibleEmbersForUser(auth.user.id);

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
    const ownedImage = await ensureEmberOwnerAccess(auth.user.id, id);

    if (!ownedImage) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await request.json();

    const updateData: {
      shareToNetwork?: boolean;
      keepPrivate?: boolean;
      title?: string | null;
      titleUpdatedAt?: Date | null;
      description?: string | null;
      cropX?: number | null;
      cropY?: number | null;
      cropWidth?: number | null;
      cropHeight?: number | null;
    } = {};
    let capturedAtValue: Date | null | undefined;

    if (typeof body?.shareToNetwork === 'boolean') {
      updateData.shareToNetwork = body.shareToNetwork;
    }

    if (typeof body?.keepPrivate === 'boolean') {
      updateData.keepPrivate = body.keepPrivate;
    }

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'title')) {
      if (body.title !== null && typeof body.title !== 'string') {
        return NextResponse.json(
          { error: 'title must be a string or null' },
          { status: 400 }
        );
      }

      if (typeof body.title === 'string' && body.title.trim().length > 40) {
        return NextResponse.json(
          { error: 'title must be 40 characters or fewer' },
          { status: 400 }
        );
      }

      updateData.title = typeof body.title === 'string' ? (toTitleCase(body.title) || null) : null;
      updateData.titleUpdatedAt = new Date();
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

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'crop')) {
      const crop = body.crop;
      if (crop === null) {
        updateData.cropX = null;
        updateData.cropY = null;
        updateData.cropWidth = null;
        updateData.cropHeight = null;
      } else if (
        typeof crop?.x === 'number' &&
        typeof crop?.y === 'number' &&
        typeof crop?.width === 'number' &&
        typeof crop?.height === 'number'
      ) {
        updateData.cropX = crop.x;
        updateData.cropY = crop.y;
        updateData.cropWidth = crop.width;
        updateData.cropHeight = crop.height;
      }
    }

    const noContributorsValue =
      typeof body?.noContributors === 'boolean' ? body.noContributors : undefined;

    if (
      Object.keys(updateData).length === 0 &&
      capturedAtValue === undefined &&
      noContributorsValue === undefined
    ) {
      return NextResponse.json(
        { error: 'No valid image fields were provided' },
        { status: 400 }
      );
    }

    const image = Object.keys(updateData).length > 0
      ? await prisma.image.update({
          where: { id },
          data: updateData,
          select: {
            id: true,
            shareToNetwork: true,
            title: true,
            description: true,
          },
        })
      : await prisma.image.findUnique({
          where: { id },
          select: {
            id: true,
            shareToNetwork: true,
            title: true,
            description: true,
          },
        });

    if (capturedAtValue !== undefined || noContributorsValue !== undefined) {
      const existing = await prisma.imageAnalysis.findUnique({
        where: { imageId: id },
        select: { metadataJson: true },
      });
      await prisma.imageAnalysis.upsert({
        where: { imageId: id },
        update: {
          ...(capturedAtValue !== undefined ? { capturedAt: capturedAtValue } : {}),
          ...(noContributorsValue !== undefined
            ? { metadataJson: mergeNoContributors(existing?.metadataJson, noContributorsValue) }
            : {}),
        },
        create: {
          imageId: id,
          status: 'partial',
          ...(capturedAtValue !== undefined ? { capturedAt: capturedAtValue } : {}),
          ...(noContributorsValue !== undefined
            ? { metadataJson: mergeNoContributors(null, noContributorsValue) }
            : {}),
        },
      });
    }

    invalidateAccessibleEmbersForUser(auth.user.id);

    return NextResponse.json(image);
  } catch (error) {
    console.error('Error updating image:', error);
    return NextResponse.json(
      { error: 'Failed to update image' },
      { status: 500 }
    );
  }
}
