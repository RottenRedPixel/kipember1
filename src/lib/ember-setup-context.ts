import { prisma } from '@/lib/db';
import { getEmberTitle } from '@/lib/ember-title';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';

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
          name: true,
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
          contributorId: true,
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
              name: true,
              email: true,
            },
          },
          contributor: {
            select: {
              name: true,
              email: true,
            },
          },
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
        .map((tag) => tag.user?.name || tag.contributor?.name || tag.label)
        .map((label) => label?.trim())
        .filter((label): label is string => Boolean(label))
    )
  );
  const confirmedLocation = parseConfirmedLocationContext(image.analysis?.metadataJson);
  const contributorMemories = image.contributors.flatMap((contributor) =>
    (contributor.emberSession?.messages || []).map((message) => ({
      id: message.id,
      contributorId: contributor.id,
      contributorUserId: contributor.user?.id || contributor.userId || null,
      contributorName:
        contributor.name ||
        contributor.user?.name ||
        contributor.email ||
        contributor.phoneNumber ||
        'Contributor',
      questionType: message.questionType!,
      question: message.question || '',
      answer: message.content,
      source: message.source,
      createdAt: toIsoString(message.createdAt),
    }))
  );
  const callSummaries = image.contributors.flatMap((contributor) =>
    contributor.voiceCalls
      .map((voiceCall) => voiceCall.callSummary?.trim())
      .filter((summary): summary is string => Boolean(summary))
      .map((summary) => ({
        contributorId: contributor.id,
        contributorUserId: contributor.user?.id || contributor.userId || null,
        contributorName:
          contributor.name ||
          contributor.user?.name ||
          contributor.email ||
          contributor.phoneNumber ||
          'Contributor',
        summary,
      }))
  );
  const callHighlights = image.voiceCallClips.map((clip) => ({
    id: clip.id,
    voiceCallId: clip.voiceCallId,
    contributorId: clip.contributorId,
    contributorUserId:
      clip.contributor.user?.id || clip.contributor.userId || null,
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
