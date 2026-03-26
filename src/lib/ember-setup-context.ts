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
          conversation: {
            include: {
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
    (contributor.conversation?.responses || []).map((response) => ({
      id: response.id,
      contributorId: contributor.id,
      contributorUserId: contributor.user?.id || contributor.userId || null,
      contributorName:
        contributor.name ||
        contributor.user?.name ||
        contributor.email ||
        contributor.phoneNumber ||
        'Contributor',
      questionType: response.questionType,
      question: response.question,
      answer: response.answer,
      source: response.source,
      createdAt: toIsoString(response.createdAt),
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
    promptContext,
  };
}
