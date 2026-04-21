import { prisma } from '@/lib/db';

type InteractionSource = 'web' | 'sms' | 'voice' | 'system';
type InteractionActor = 'ember' | 'contributor' | 'system';

type StoryCircleInternalEntry = {
  id: string;
  actor: InteractionActor;
  source: InteractionSource;
  contributorName: string | null;
  participantLabel: string;
  content: string;
  timestamp: Date;
  sortOrder: number;
};

export type StoryCircleEntry = {
  id: string;
  actor: InteractionActor;
  source: InteractionSource;
  contributorName: string | null;
  participantLabel: string;
  content: string;
  timestamp: string;
};

export type StoryCircleData = {
  image: {
    id: string;
    filename: string;
    mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO';
    posterFilename: string | null;
    originalName: string;
    description: string | null;
  };
  contributorCount: number;
  entryCount: number;
  entries: StoryCircleEntry[];
};

const QUESTION_ORDER = new Map(
  ['context', 'who', 'when', 'where', 'what', 'why', 'how', 'followup'].map(
    (questionType, index) => [questionType, index]
  )
);

function normalizeSource(source: string | null | undefined): InteractionSource {
  return source === 'sms' || source === 'voice' || source === 'web' ? source : 'system';
}

function getContributorLabel(name: string | null, index: number): string {
  const trimmed = name?.trim();
  return trimmed || `Contributor ${index + 1}`;
}

function normalizeStoryEntryText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim().toLowerCase() || '';
}

export async function getStoryCircleForImage(imageId: string): Promise<StoryCircleData | null> {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    include: {
      contributors: {
        orderBy: { createdAt: 'asc' },
        include: {
          emberSession: {
            include: {
              messages: {
                orderBy: { createdAt: 'asc' },
              },
            },
          },
          voiceCalls: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              createdAt: true,
              startedAt: true,
              callSummary: true,
              emberSession: {
                include: {
                  messages: {
                    orderBy: { createdAt: 'asc' },
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

  const entries: StoryCircleInternalEntry[] = [];

  image.contributors.forEach((contributor, contributorIndex) => {
    const contributorLabel = getContributorLabel(contributor.name, contributorIndex);
    const existingConversationKeys = new Set<string>();

    for (const voiceCall of contributor.voiceCalls) {
      const summary = voiceCall.callSummary?.trim();
      entries.push({
        id: `voice-call-${voiceCall.id}`,
        actor: 'system',
        source: 'voice',
        contributorName: contributor.name,
        participantLabel: contributorLabel,
        content: summary
          ? `Voice call with ${contributorLabel}. ${summary}`
          : `Ember had a voice call with ${contributorLabel}.`,
        timestamp: voiceCall.startedAt || voiceCall.createdAt,
        sortOrder: 0,
      });
    }

    const conversationMessages = [
      ...(contributor.emberSession?.messages || []),
      ...contributor.voiceCalls.flatMap((voiceCall) => voiceCall.emberSession?.messages || []),
    ];

    for (const message of conversationMessages) {
      const normalizedText = normalizeStoryEntryText(message.content);
      if (normalizedText) {
        existingConversationKeys.add(
          `${message.role === 'assistant' ? 'ember' : 'contributor'}::${normalizedText}`
        );
      }

      entries.push({
        id: `message-${message.id}`,
        actor: message.role === 'assistant' ? 'ember' : 'contributor',
        source: normalizeSource(message.source),
        contributorName: contributor.name,
        participantLabel: message.role === 'assistant' ? 'Ember' : contributorLabel,
        content: message.content,
        timestamp: message.createdAt,
        sortOrder: 10,
      });
    }

    const voiceAnswers = conversationMessages.filter(
      (m) => m.role === 'user' && m.questionType && m.source === 'voice'
    );

    for (const response of voiceAnswers) {
      const sequence = QUESTION_ORDER.get(response.questionType!) ?? QUESTION_ORDER.size;
      const questionSortOrder = 100 + sequence * 2;

      if (response.question?.trim()) {
        const questionKey = `ember::${normalizeStoryEntryText(response.question)}`;
        if (!existingConversationKeys.has(questionKey)) {
          existingConversationKeys.add(questionKey);
          entries.push({
            id: `voice-question-${response.id}`,
            actor: 'ember',
            source: 'voice',
            contributorName: contributor.name,
            participantLabel: 'Ember',
            content: response.question,
            timestamp: response.createdAt,
            sortOrder: questionSortOrder,
          });
        }
      }

      const answerKey = `contributor::${normalizeStoryEntryText(response.content)}`;
      if (!existingConversationKeys.has(answerKey)) {
        existingConversationKeys.add(answerKey);
        entries.push({
          id: `voice-answer-${response.id}`,
          actor: 'contributor',
          source: 'voice',
          contributorName: contributor.name,
          participantLabel: contributorLabel,
          content: response.content,
          timestamp: response.createdAt,
          sortOrder: questionSortOrder + 1,
        });
      }
    }
  });

  entries.sort((left, right) => {
    const timeDelta = left.timestamp.getTime() - right.timestamp.getTime();
    if (timeDelta !== 0) {
      return timeDelta;
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.id.localeCompare(right.id);
  });

  return {
    image: {
      id: image.id,
      filename: image.filename,
      mediaType: image.mediaType,
      posterFilename: image.posterFilename,
      originalName: image.originalName,
      description: image.description,
    },
    contributorCount: image.contributors.length,
    entryCount: entries.length,
    entries: entries.map((entry) => ({
      id: entry.id,
      actor: entry.actor,
      source: entry.source,
      contributorName: entry.contributorName,
      participantLabel: entry.participantLabel,
      content: entry.content,
      timestamp: entry.timestamp.toISOString(),
    })),
  };
}
