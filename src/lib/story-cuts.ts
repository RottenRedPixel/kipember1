import { getOpenAIClient, getStoryCutsModel } from '@/lib/openai';

type SetupContext = Awaited<ReturnType<typeof import('@/lib/ember-setup-context').loadEmberSetupContext>>;

export type StoryCutStyle =
  | 'documentary'
  | 'publicRadio'
  | 'newsReport'
  | 'podcastNarrative'
  | 'movieTrailer';

type StoryCutMediaBlock = {
  type: 'media';
  mediaId: string | null;
  mediaName: string | null;
  mediaUrl: string | null;
  order: number;
};

type StoryCutVoiceBlock = {
  type: 'voice';
  speaker: string | null;
  content: string | null;
  voicePreference: string | null;
  messageId: string | null;
  userId: string | null;
  order: number;
};

export type StoryCutResult = {
  title: string;
  style: string;
  duration: number;
  wordCount: number;
  script: string;
  blocks: Array<StoryCutMediaBlock | StoryCutVoiceBlock>;
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

type GenerateStoryCutOptions = {
  style: StoryCutStyle;
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

function isVoiceBlock(block: StoryCutMediaBlock | StoryCutVoiceBlock): block is StoryCutVoiceBlock {
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

const STORY_CUT_STYLE_PROMPTS: Record<StoryCutStyle, { label: string; prompt: string }> = {
  documentary: {
    label: 'Documentary',
    prompt: `Create a DOCUMENTARY style story cut.

Pacing:
- Thoughtful, measured pacing
- Let moments breathe
- Build understanding gradually

Tone:
- Reflective and introspective
- Educational but warm
- Respectful and grounded

Focus:
- Context and meaning
- Human connections and relationships
- Quiet contemplative moments
- Depth over drama`,
  },
  publicRadio: {
    label: 'Public Radio',
    prompt: `Create a PUBLIC RADIO style story cut.

Pacing:
- Gentle, unhurried pacing
- Natural pauses and reflection
- Conversational and intimate rhythm

Tone:
- Warm and intimate
- Emotionally intelligent
- Vulnerable and honest

Focus:
- Sensory detail and atmosphere
- Human emotions and connection
- Personal meaning and resonance
- The beauty in everyday experiences`,
  },
  newsReport: {
    label: 'News Report',
    prompt: `Create a NEWS REPORT style story cut.

Pacing:
- Clear, steady pacing
- Logical point-to-point structure
- Efficient use of time

Tone:
- Professional and credible
- Balanced and respectful

Focus:
- Lead with the most important information
- Follow the 5 Ws
- Establish a clear timeline
- Highlight significance without becoming dramatic`,
  },
  podcastNarrative: {
    label: 'Podcast Narrative',
    prompt: `Create a PODCAST NARRATIVE style story cut.

Pacing:
- Engaging, conversational pacing
- Build momentum and curiosity
- Use pauses for emphasis

Tone:
- Authentic and relatable
- Conversational but polished
- Emotionally engaging

Focus:
- Strong hook
- Clear beginning, middle, and end
- Natural storytelling techniques
- Broader meaning through a personal moment`,
  },
  movieTrailer: {
    label: 'Movie Trailer',
    prompt: `Create a MOVIE TRAILER style story cut.

Pacing:
- Fast-paced and dynamic
- Short, punchy phrases
- Build momentum throughout

Tone:
- Dramatic and exciting
- High-energy but still truthful to the memory

Focus:
- Emotional peaks
- Tension and release
- Strong hook and satisfying final beat
- Never invent facts beyond the provided memory material`,
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

function sanitizeStoryCutResult(
  payload: StoryCutResult,
  fallback: {
    styleLabel: string;
    durationSeconds: number;
    wordCount: number;
    emberTitle: string;
    storyFocus: string;
    contributorCount: number;
    hasDirectQuotes: boolean;
  }
): StoryCutResult {
  const blocks = Array.isArray(payload.blocks)
    ? payload.blocks
        .filter((block) => block && typeof block === 'object' && typeof block.order === 'number')
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

export function getStoryCutStyleOptions() {
  return Object.entries(STORY_CUT_STYLE_PROMPTS).map(([value, config]) => ({
    value: value as StoryCutStyle,
    label: config.label,
  }));
}

export async function generateStoryCut(
  context: NonNullable<SetupContext>,
  options: GenerateStoryCutOptions
) {
  const durationSeconds = clampDuration(options.durationSeconds);
  const wordCount = estimateWordCount(durationSeconds);
  const styleConfig = STORY_CUT_STYLE_PROMPTS[options.style] || STORY_CUT_STYLE_PROMPTS.documentary;
  const storyFocus = options.storyFocus.trim() || 'The emotional heart of the moment';
  const storyTitle = options.storyTitle?.trim() || context.imageTitle;
  const selectedContributorIds = new Set(options.selectedContributorIds || []);
  const includeOwner = options.includeOwner !== false;
  const includeEmberVoice = options.includeEmberVoice !== false;
  const includeNarratorVoice = options.includeNarratorVoice !== false;
  const emberVoiceLabel = options.emberVoiceLabel?.trim() || 'Ember';
  const narratorVoiceLabel = options.narratorVoiceLabel?.trim() || 'Narrator';

  const mediaPool = [
    {
      mediaId: context.image.id,
      mediaName: context.imageTitle,
      mediaUrl:
        context.image.mediaType === 'VIDEO' && context.image.posterFilename
          ? `/api/uploads/${context.image.posterFilename}`
          : `/api/uploads/${context.image.filename}`,
      kind: 'cover',
    },
    ...context.image.attachments.map((attachment) => ({
      mediaId: attachment.id,
      mediaName: attachment.originalName,
      mediaUrl:
        attachment.mediaType === 'VIDEO' && attachment.posterFilename
          ? `/api/uploads/${attachment.posterFilename}`
          : `/api/uploads/${attachment.filename}`,
      kind: 'supporting',
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
    `SELECTED MEDIA FOR STORY\n${selectedMedia
      .map((media, index) => `${index + 1}. ${media.mediaName} (${media.kind})`)
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
  const response = await openai.responses.create({
    model: getStoryCutsModel(),
    input: [
      {
        role: 'developer',
        type: 'message',
        content: [
          {
            type: 'input_text',
            text: `You generate Story Cuts for Ember.

Story Cuts are NOT generic wiki narration. They are purpose-built, audio-ready story segments.

${styleConfig.prompt}

Rules:
- Use only the provided Ember context, Story Circle conversations, contributor quotes, media, and call summaries.
- Keep contributor quotes exact when you use them. Do not rewrite, paraphrase, summarize, or improve a contributor quote.
- Only Ember voice and Narrator voice may contain AI-written lines.
- If context is thin, stay emotionally grounded without inventing specifics.
- Always include the cover photo as the first media block.
- Use supporting media blocks only when they help the flow.
- Build a clear emotional arc that matches the selected style.
- The script should read like a polished story cut, not like a wiki section list.
- Respect the requested voice casting. If Ember voice is disabled, do not create EMBER VOICE lines. If Narrator is disabled, do not create NARRATOR lines.
- Return JSON only matching the schema exactly.`,
          },
        ],
      },
      {
        role: 'user',
        type: 'message',
        content: [
          {
            type: 'input_text',
            text: `Create a Story Cut for this Ember.

STORY MATERIAL
${storyContext}

STORY CONFIGURATION
- Title: ${storyTitle}
- Duration: ${durationSeconds} seconds
- Target spoken length: approximately ${wordCount} words
- Focus: ${storyFocus}
- Owner First Name: ${ownerFirstName}
- Selected Contributors: ${Array.from(contributorNameSet).join(', ') || 'None'}
- Ember Voice enabled: ${includeEmberVoice ? 'yes' : 'no'}
- Ember Voice label: ${emberVoiceLabel}
- Narrator enabled: ${includeNarratorVoice ? 'yes' : 'no'}
- Narrator Voice label: ${narratorVoiceLabel}
- Voice casting info: Use Ember and Narrator only when enabled. Use contributor names only for exact contributor quotes.

Build the JSON blocks in order so this cut could be rendered later as audio plus media.`,
          },
        ],
      },
    ],
    text: {
      verbosity: 'low',
      format: {
        type: 'json_schema',
        name: 'ember_story_cut',
        description: 'Structured Story Cut output for Ember.',
        schema: STORY_CUT_SCHEMA,
        strict: false,
      },
    },
  });

  return sanitizeStoryCutResult(parseJson<StoryCutResult>(response.output_text || '{}'), {
    styleLabel: styleConfig.label,
    durationSeconds,
    wordCount,
    emberTitle: storyTitle,
    storyFocus,
    contributorCount: contributorNameSet.size,
    hasDirectQuotes: contributorQuotes.length > 0,
  });
}
