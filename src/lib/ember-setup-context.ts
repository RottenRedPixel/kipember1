import { prisma } from '@/lib/db';
import { getEmberTitle } from '@/lib/ember-title';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';
import { getUserDisplayName } from '@/lib/user-name';

function compactLines(lines: Array<string | null | undefined>) {
  return lines
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join('\n');
}

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export async function loadEmberSetupContext(imageId: string) {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    include: {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      wiki: {
        select: {
          content: true,
          version: true,
          updatedAt: true,
        },
      },
      analysis: true,
      voiceCallClips: {
        orderBy: [{ createdAt: 'asc' }, { sortOrder: 'asc' }],
        select: {
          id: true,
          emberContributorId: true,
          voiceCallId: true,
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
              userId: true,
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
        },
      },
      attachments: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          filename: true,
          posterFilename: true,
          originalName: true,
          mediaType: true,
          description: true,
          createdAt: true,
        },
      },
      tags: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          emberContributor: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      emberContributors: {
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
          emberSession: {
            include: {
              messages: {
                where: { role: 'user', questionType: { not: null } },
                orderBy: { createdAt: 'asc' },
                select: {
                  id: true,
                  questionType: true,
                  question: true,
                  content: true,
                  source: true,
                  createdAt: true,
                },
              },
            },
          },
          voiceCalls: {
            where: {
              callSummary: {
                not: null,
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: {
              id: true,
              callSummary: true,
              createdAt: true,
              emberSession: {
                select: {
                  messages: {
                    where: { role: 'user', questionType: { not: null } },
                    orderBy: { createdAt: 'asc' },
                    select: {
                      id: true,
                      questionType: true,
                      question: true,
                      content: true,
                      source: true,
                      createdAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!image) {
    return null;
  }

  const imageTitle = getEmberTitle(image);
  const confirmedPeople = Array.from(
    new Set(
      image.tags
        .map((tag) => getUserDisplayName(tag.user) || getUserDisplayName(tag.emberContributor?.user) || tag.label)
        .map((label) => label?.trim())
        .filter((label): label is string => Boolean(label))
    )
  );
  const confirmedLocation = parseConfirmedLocationContext(image.analysis?.metadataJson);
  const contributorMemories = image.emberContributors.flatMap((ec) =>
    [
      ...(ec.emberSession?.messages || []),
      ...ec.voiceCalls.flatMap((voiceCall) => voiceCall.emberSession?.messages || []),
    ].map((message) => ({
      id: message.id,
      contributorId: ec.id,
      contributorUserId: ec.user?.id ?? ec.userId ?? null,
      contributorName:
        getUserDisplayName(ec.user) ||
        ec.user?.email ||
        ec.user?.phoneNumber ||
        'Contributor',
      questionType: message.questionType!,
      question: message.question || '',
      answer: message.content,
      source: message.source,
      createdAt: toIsoString(message.createdAt),
    }))
  );
  const callSummaries = image.emberContributors.flatMap((ec) =>
    ec.voiceCalls
      .map((voiceCall) => voiceCall.callSummary?.trim())
      .filter((summary): summary is string => Boolean(summary))
      .map((summary) => ({
        contributorId: ec.id,
        contributorUserId: ec.user?.id ?? ec.userId ?? null,
        contributorName:
          getUserDisplayName(ec.user) ||
          ec.user?.email ||
          ec.user?.phoneNumber ||
          'Contributor',
        summary,
      }))
  );
  const callHighlights = image.voiceCallClips.map((clip) => ({
    id: clip.id,
    voiceCallId: clip.voiceCallId,
    contributorId: clip.emberContributorId,
    contributorUserId:
      clip.emberContributor.user?.id || clip.emberContributor.userId || null,
    contributorName:
      getUserDisplayName(clip.emberContributor.user) ||
      clip.emberContributor.user?.email ||
      clip.emberContributor.user?.phoneNumber ||
      'Contributor',
    title: clip.title,
    quote: clip.quote,
    significance: clip.significance,
    speaker: clip.speaker,
    audioUrl: clip.audioUrl,
    startMs: clip.startMs,
    endMs: clip.endMs,
    canUseForTitle: clip.canUseForTitle,
    createdAt: toIsoString(clip.createdAt),
  }));

  const promptContext = compactLines([
    `EMBER TITLE\n${imageTitle}`,
    image.description ? `CAPTION\n${image.description}` : null,
    image.analysis?.summary ? `IMAGE SUMMARY\n${image.analysis.summary}` : null,
    image.analysis?.visualDescription
      ? `VISUAL DESCRIPTION\n${image.analysis.visualDescription}`
      : null,
    image.analysis?.sceneInsightsJson
      ? `SCENE INSIGHTS JSON\n${image.analysis.sceneInsightsJson}`
      : null,
    confirmedPeople.length > 0
      ? `TAGGED PEOPLE\n${confirmedPeople.join(', ')}`
      : null,
    confirmedLocation
      ? `CONFIRMED LOCATION\n${[
          confirmedLocation.label,
          confirmedLocation.detail,
        ]
          .filter(Boolean)
          .join(', ')}`
      : null,
    image.analysis?.capturedAt
      ? `CAPTURED AT\n${image.analysis.capturedAt.toISOString()}`
      : null,
    contributorMemories.length > 0
      ? `CONTRIBUTOR MEMORIES\n${contributorMemories
          .map(
            (memory) =>
              `${memory.contributorName} (${memory.questionType}): ${memory.answer}`
          )
          .join('\n')}`
      : null,
    callSummaries.length > 0
      ? `VOICE CALL SUMMARIES\n${callSummaries
          .map((call) => `${call.contributorName}: ${call.summary}`)
          .join('\n')}`
      : null,
    callHighlights.length > 0
      ? `VOICE CALL HIGHLIGHTS\n${callHighlights
          .map((clip) =>
            [
              `${clip.contributorName} - ${clip.title}: "${clip.quote}"`,
              clip.significance ? `Why it matters: ${clip.significance}` : null,
              clip.canUseForTitle ? 'Usable for smart title ideas.' : null,
            ]
              .filter(Boolean)
              .join(' ')
          )
          .join('\n')}`
      : null,
    image.attachments.length > 0
      ? `SUPPORTING MEDIA NOTES\n${image.attachments
          .filter((attachment) => attachment.description?.trim())
          .map(
            (attachment) =>
              `${attachment.originalName}: ${attachment.description?.trim()}`
          )
          .join('\n')}`
      : null,
    image.wiki?.content
      ? `CURRENT WIKI\n${image.wiki.content.slice(0, 8000)}`
      : null,
  ]);

  return {
    image,
    imageTitle,
    confirmedPeople,
    confirmedLocation,
    contributorMemories,
    callSummaries,
    callHighlights,
    promptContext,
  };
}
