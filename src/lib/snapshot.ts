import { renderPromptTemplate } from '@/lib/control-plane';
import { getConfiguredOpenAIModel, getOpenAIClient, getSnapshotModel } from '@/lib/openai';

type SetupContext = Awaited<ReturnType<typeof import('@/lib/ember-setup-context').loadEmberSetupContext>>;

export type SnapshotStyle =
  | 'documentary'
  | 'publicRadio'
  | 'newsReport'
  | 'podcastNarrative'
  | 'movieTrailer';

type SnapshotMediaBlock = {
  type: 'media';
  mediaId: string | null;
  mediaName: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  clipStartMs?: number | null;
  clipEndMs?: number | null;
  clipQuote?: string | null;
  order: number;
};

type SnapshotVoiceBlock = {
  type: 'voice';
  speaker: string | null;
  content: string | null;
  voicePreference: string | null;
  messageId: string | null;
  userId: string | null;
  order: number;
};

export type SnapshotResult = {
  title: string;
  style: string;
  duration: number;
  wordCount: number;
  script: string;
  blocks: Array<SnapshotMediaBlock | SnapshotVoiceBlock>;
  emberVoiceLines: string[];
  narratorVoiceLines: string[];
  ownerLines: string[];
  contributorLines: string[];
  metadata: {
    focus: string;
    emberTitle: string;
    styleApplied: string;
    totalContributors: number;
    hasDirectQuotes: boolean;
  };
};

type GenerateSnapshotOptions = {
  style: SnapshotStyle;
  durationSeconds: number;
  storyFocus: string;
  storyTitle?: string;
  selectedMediaIds?: string[];
  selectedContributorIds?: string[];
  includeOwner?: boolean;
  includeEmberVoice?: boolean;
  includeNarratorVoice?: boolean;
  emberVoiceLabel?: string;
  narratorVoiceLabel?: string;
};

function isVoiceBlock(block: SnapshotMediaBlock | SnapshotVoiceBlock): block is SnapshotVoiceBlock {
  return block.type === 'voice';
}

const STORY_CUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'style',
    'duration',
    'wordCount',
    'script',
    'blocks',
    'emberVoiceLines',
    'narratorVoiceLines',
    'ownerLines',
    'contributorLines',
    'metadata',
  ],
  properties: {
    title: { type: 'string' },
    style: { type: 'string' },
    duration: { type: 'number' },
    wordCount: { type: 'number' },
    script: { type: 'string' },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'order'],
        properties: {
          type: {
            type: 'string',
            enum: ['media', 'voice'],
          },
          order: { type: 'number' },
          speaker: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          content: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          voicePreference: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          messageId: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          userId: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          mediaId: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          mediaName: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          mediaUrl: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          mediaType: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          clipStartMs: {
            anyOf: [{ type: 'number' }, { type: 'null' }],
          },
          clipEndMs: {
            anyOf: [{ type: 'number' }, { type: 'null' }],
          },
          clipQuote: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
        },
      },
    },
    emberVoiceLines: {
      type: 'array',
      items: { type: 'string' },
    },
    narratorVoiceLines: {
      type: 'array',
      items: { type: 'string' },
    },
    ownerLines: {
      type: 'array',
      items: { type: 'string' },
    },
    contributorLines: {
      type: 'array',
      items: { type: 'string' },
    },
    metadata: {
      type: 'object',
      additionalProperties: false,
      required: [
        'focus',
        'emberTitle',
        'styleApplied',
        'totalContributors',
        'hasDirectQuotes',
      ],
      properties: {
        focus: { type: 'string' },
        emberTitle: { type: 'string' },
        styleApplied: { type: 'string' },
        totalContributors: { type: 'number' },
        hasDirectQuotes: { type: 'boolean' },
      },
    },
  },
} as const;

const STORY_CUT_STYLE_PROMPTS: Record<SnapshotStyle, { label: string }> = {
  documentary: {
    label: 'Documentary',
  },
  publicRadio: {
    label: 'Public Radio',
  },
  newsReport: {
    label: 'News Report',
  },
  podcastNarrative: {
    label: 'Podcast Narrative',
  },
  movieTrailer: {
    label: 'Movie Trailer',
  },
};

function clampDuration(value: number) {
  if (!Number.isFinite(value)) {
    return 10;
  }

  return Math.max(5, Math.min(60, Math.round(value)));
}

function estimateWordCount(durationSeconds: number) {
  return Math.max(16, Math.round(durationSeconds * 2.35));
}

function compactLines(lines: Array<string | null | undefined>) {
  return lines
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join('\n');
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function normalizeMediaToken(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveSnapshotMediaBlock(
  block: SnapshotMediaBlock,
  mediaChoices: Array<{
    mediaId: string;
    mediaName: string;
    mediaType: string;
    mediaUrl: string | null;
    clipStartMs?: number | null;
    clipEndMs?: number | null;
    clipQuote?: string | null;
  }>
): SnapshotMediaBlock {
  const exactId = block.mediaId
    ? mediaChoices.find((media) => media.mediaId === block.mediaId) || null
    : null;
  const exactUrl = !exactId && block.mediaUrl
    ? mediaChoices.find((media) => media.mediaUrl === block.mediaUrl) || null
    : null;
  const blockName = normalizeMediaToken(block.mediaName);
  const blockQuote = normalizeMediaToken(block.clipQuote);
  const matchingTypeChoices = mediaChoices.filter(
    (media) => !block.mediaType || media.mediaType === block.mediaType
  );
  const nameMatch =
    !exactId && !exactUrl && blockName
      ? matchingTypeChoices.find((media) => normalizeMediaToken(media.mediaName) === blockName) ||
        matchingTypeChoices.find((media) => {
          const mediaName = normalizeMediaToken(media.mediaName);
          return mediaName.includes(blockName) || blockName.includes(mediaName);
        }) ||
        null
      : null;
  const quoteMatch =
    !exactId && !exactUrl && !nameMatch && blockQuote
      ? matchingTypeChoices.find((media) => {
          const mediaQuote = normalizeMediaToken(media.clipQuote);
          if (!mediaQuote) {
            return false;
          }
          return (
            mediaQuote === blockQuote ||
            mediaQuote.includes(blockQuote) ||
            blockQuote.includes(mediaQuote)
          );
        }) || null
      : null;
  const resolved = exactId || exactUrl || nameMatch || quoteMatch;

  if (!resolved) {
    return block;
  }

  return {
    ...block,
    mediaId: block.mediaId || resolved.mediaId,
    mediaName: block.mediaName || resolved.mediaName,
    mediaUrl: block.mediaUrl || resolved.mediaUrl,
    mediaType: block.mediaType || resolved.mediaType,
    clipStartMs:
      typeof resolved.clipStartMs === 'number'
        ? resolved.clipStartMs
        : typeof block.clipStartMs === 'number'
          ? block.clipStartMs
          : null,
    clipEndMs:
      typeof resolved.clipEndMs === 'number'
        ? resolved.clipEndMs
        : typeof block.clipEndMs === 'number'
          ? block.clipEndMs
          : null,
    clipQuote: block.clipQuote || resolved.clipQuote || null,
  };
}

function sanitizeSnapshotResult(
  payload: SnapshotResult,
  fallback: {
    styleLabel: string;
    durationSeconds: number;
    wordCount: number;
    emberTitle: string;
    storyFocus: string;
    contributorCount: number;
    hasDirectQuotes: boolean;
  },
  mediaChoices: Array<{
    mediaId: string;
    mediaName: string;
    mediaType: string;
    mediaUrl: string | null;
    clipStartMs?: number | null;
    clipEndMs?: number | null;
    clipQuote?: string | null;
  }>
): SnapshotResult {
  const blocks = Array.isArray(payload.blocks)
    ? payload.blocks
        .filter((block) => block && typeof block === 'object' && typeof block.order === 'number')
        .map((block) =>
          !isVoiceBlock(block as SnapshotMediaBlock | SnapshotVoiceBlock)
            ? resolveSnapshotMediaBlock(block as SnapshotMediaBlock, mediaChoices)
            : (block as SnapshotVoiceBlock)
        )
        .sort((left, right) => left.order - right.order)
    : [];

  const script =
    typeof payload.script === 'string' && payload.script.trim()
      ? payload.script.trim()
      : blocks
          .filter(isVoiceBlock)
          .filter((block) => typeof block.content === 'string')
          .map((block) => block.content!.trim())
          .filter(Boolean)
          .join(' ');

  return {
    title: typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : fallback.emberTitle,
    style:
      typeof payload.style === 'string' && payload.style.trim()
        ? payload.style.trim()
        : fallback.styleLabel,
    duration:
      typeof payload.duration === 'number' && Number.isFinite(payload.duration)
        ? payload.duration
        : fallback.durationSeconds,
    wordCount:
      typeof payload.wordCount === 'number' && Number.isFinite(payload.wordCount)
        ? payload.wordCount
        : fallback.wordCount,
    script,
    blocks,
    emberVoiceLines: Array.isArray(payload.emberVoiceLines)
      ? payload.emberVoiceLines.filter((line) => typeof line === 'string' && line.trim())
      : [],
    narratorVoiceLines: Array.isArray(payload.narratorVoiceLines)
      ? payload.narratorVoiceLines.filter((line) => typeof line === 'string' && line.trim())
      : [],
    ownerLines: Array.isArray(payload.ownerLines)
      ? payload.ownerLines.filter((line) => typeof line === 'string' && line.trim())
      : [],
    contributorLines: Array.isArray(payload.contributorLines)
      ? payload.contributorLines.filter((line) => typeof line === 'string' && line.trim())
      : [],
    metadata: {
      focus:
        typeof payload.metadata?.focus === 'string' && payload.metadata.focus.trim()
          ? payload.metadata.focus.trim()
          : fallback.storyFocus,
      emberTitle:
        typeof payload.metadata?.emberTitle === 'string' && payload.metadata.emberTitle.trim()
          ? payload.metadata.emberTitle.trim()
          : fallback.emberTitle,
      styleApplied:
        typeof payload.metadata?.styleApplied === 'string' && payload.metadata.styleApplied.trim()
          ? payload.metadata.styleApplied.trim()
          : fallback.styleLabel,
      totalContributors:
        typeof payload.metadata?.totalContributors === 'number' &&
        Number.isFinite(payload.metadata.totalContributors)
          ? payload.metadata.totalContributors
          : fallback.contributorCount,
      hasDirectQuotes:
        typeof payload.metadata?.hasDirectQuotes === 'boolean'
          ? payload.metadata.hasDirectQuotes
          : fallback.hasDirectQuotes,
    },
  };
}

export function getSnapshotStyleOptions() {
  return Object.entries(STORY_CUT_STYLE_PROMPTS).map(([value, config]) => ({
    value: value as SnapshotStyle,
    label: config.label,
  }));
}

export async function generateSnapshot(
  context: NonNullable<SetupContext>,
  options: GenerateSnapshotOptions
) {
  const durationSeconds = clampDuration(options.durationSeconds);
  const wordCount = estimateWordCount(durationSeconds);
  const styleConfig = STORY_CUT_STYLE_PROMPTS[options.style] || STORY_CUT_STYLE_PROMPTS.documentary;
  const storyFocus = options.storyFocus.trim() || 'The emotional heart of the moment';
  const storyTitle = options.storyTitle?.trim() || context.imageTitle;
  const selectedContributorIds = new Set(options.selectedContributorIds || []);
  const includeOwner = options.includeOwner !== false;
  const includeEmberVoice = options.includeEmberVoice !== false;
  const emberVoiceLabel = options.emberVoiceLabel?.trim() || 'Ember';

  const mediaPool = [
    {
      mediaId: context.image.id,
      mediaName: context.imageTitle,
      mediaType: context.image.mediaType,
      mediaUrl:
        context.image.mediaType === 'VIDEO' && context.image.posterFilename
          ? `/api/uploads/${context.image.posterFilename}`
          : `/api/uploads/${context.image.filename}`,
      kind: 'cover',
    },
    ...context.image.attachments.map((attachment) => ({
      mediaId: attachment.id,
      mediaName: attachment.originalName,
      mediaType: attachment.mediaType,
      mediaUrl:
        attachment.mediaType === 'VIDEO' && attachment.posterFilename
          ? `/api/uploads/${attachment.posterFilename}`
          : `/api/uploads/${attachment.filename}`,
      kind: 'supporting',
    })),
    ...context.callHighlights
      .filter((clip) => clip.audioUrl)
      .map((clip) => ({
        mediaId: clip.id,
        mediaName: `${clip.contributorName}: ${clip.title}`,
        mediaType: 'AUDIO',
        mediaUrl: clip.audioUrl,
        kind: 'voice_clip',
        clipStartMs: clip.startMs,
        clipEndMs: clip.endMs,
        clipQuote: clip.quote,
        contributorId: clip.contributorId,
      })),
  ];
  const selectedMediaIds = new Set(
    (options.selectedMediaIds || []).filter((mediaId) =>
      mediaPool.some((media) => media.mediaId === mediaId)
    )
  );
  const selectedMedia =
    selectedMediaIds.size > 0
      ? mediaPool.filter((media) => selectedMediaIds.has(media.mediaId))
      : mediaPool.slice(0, 1);
  const contributorNameSet = new Set<string>();
  const isSelectedContributor = (contributorId: string, contributorUserId: string | null) => {
    const isOwnerContributor = contributorUserId === context.image.owner.id;

    if (isOwnerContributor) {
      return includeOwner;
    }

    if (selectedContributorIds.size === 0) {
      return true;
    }

    return selectedContributorIds.has(contributorId);
  };

  const contributorQuotes = context.contributorMemories
    .filter((memory) => isSelectedContributor(memory.contributorId, memory.contributorUserId))
    .filter((memory) => memory.answer.trim())
    .slice(0, 14)
    .map((memory) => {
      contributorNameSet.add(memory.contributorName);
      return {
        speaker: memory.contributorName,
        quote: memory.answer.trim(),
        questionType: memory.questionType,
        source: memory.source,
        messageId: memory.id,
      };
    });

  const ownerFirstName =
    context.image.owner.name?.trim().split(/\s+/)[0] ||
    context.image.owner.email.split('@')[0] ||
    'Owner';

  const storyContext = compactLines([
    `EMBER CONTEXT AND STORY MATERIAL\n${context.promptContext}`,
    contributorQuotes.length > 0
      ? `STORY CIRCLE CONVERSATIONS\n${contributorQuotes
          .map(
            (quote) =>
              `${quote.speaker} (${quote.questionType}): ${quote.quote}`
          )
          .join('\n')}`
      : null,
    context.callSummaries.length > 0
      ? `VOICE CALL SUMMARIES\n${context.callSummaries
          .filter((call) => isSelectedContributor(call.contributorId, call.contributorUserId))
          .map((call) => `${call.contributorName}: ${call.summary}`)
          .join('\n')}`
      : null,
    context.callHighlights.length > 0
      ? `VOICE CALL HIGHLIGHTS\n${context.callHighlights
          .filter((clip) => isSelectedContributor(clip.contributorId, clip.contributorUserId))
          .map(
            (clip) =>
              `${clip.contributorName} - ${clip.title}: "${clip.quote}"${
                clip.significance ? ` (${clip.significance})` : ''
              }${clip.canUseForTitle ? ' [title-worthy]' : ''}`
          )
          .join('\n')}`
      : null,
    `SELECTED MEDIA FOR STORY\n${selectedMedia
      .map(
        (media, index) =>
          `${index + 1}. ${media.mediaName} (${media.kind}, ${media.mediaType})${
            'clipQuote' in media && media.clipQuote ? ` - clip: "${media.clipQuote}"` : ''
          }${
            media.mediaType === 'AUDIO'
              ? ' [recorded audio available for inline playback]'
              : ''
          }`
      )
      .join('\n')}`,
    contributorQuotes.length > 0
      ? `DIRECT QUOTES AVAILABLE\n${contributorQuotes
          .map(
            (quote) =>
              `${quote.speaker} [${quote.questionType}] (${quote.source || 'web'}): "${quote.quote}"`
          )
          .join('\n')}`
      : 'DIRECT QUOTES AVAILABLE\nNone',
  ]);

  const openai = getOpenAIClient();
  const corePrompt = await renderPromptTemplate('snapshot_generation.regenerate', '', {
    stylePrompt: styleConfig.label,
    storyContext,
    storyTitle,
    durationSeconds,
    wordCount,
    storyFocus,
    ownerFirstName,
    selectedContributors: Array.from(contributorNameSet).join(', ') || 'None',
    includeEmberVoice: includeEmberVoice ? 'yes' : 'no',
    emberVoiceLabel,
  });
  const userPrompt = JSON.stringify(
    {
      storyContext,
      storyTitle,
      durationSeconds,
      wordCount,
      storyFocus,
      ownerFirstName,
      selectedContributors: Array.from(contributorNameSet),
      includeEmberVoice,
      emberVoiceLabel,
      selectedMedia,
    },
    null,
    2
  );
  const response = await openai.responses.create({
    model: await getConfiguredOpenAIModel('snapshots.generate', getSnapshotModel()),
    input: [
      {
        role: 'developer',
        type: 'message',
        content: [
          {
            type: 'input_text',
            text: corePrompt,
          },
        ],
      },
      {
        role: 'user',
        type: 'message',
        content: [
          {
            type: 'input_text',
            text: userPrompt,
          },
        ],
      },
    ],
    text: {
      verbosity: 'low',
      format: {
        type: 'json_schema',
        name: 'ember_snapshot',
        description: 'Structured Story Cut output for Ember.',
        schema: STORY_CUT_SCHEMA,
        strict: false,
      },
    },
  });

  return sanitizeSnapshotResult(
    parseJson<SnapshotResult>(response.output_text || '{}'),
    {
      styleLabel: styleConfig.label,
      durationSeconds,
      wordCount,
      emberTitle: storyTitle,
      storyFocus,
      contributorCount: contributorNameSet.size,
      hasDirectQuotes: contributorQuotes.length > 0,
    },
    selectedMedia
  );
}
