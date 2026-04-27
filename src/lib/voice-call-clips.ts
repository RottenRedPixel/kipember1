import { getConfiguredOpenAIModel, getOpenAIClient, getWikiStructureModel } from '@/lib/openai';
import { renderPromptTemplate } from '@/lib/control-plane';

type TranscriptRole = 'agent' | 'user' | 'transfer_target';

type RawTranscriptWord = {
  word?: unknown;
  start?: unknown;
  end?: unknown;
};

type RawTranscriptSegment = {
  content?: unknown;
  role?: unknown;
  words?: unknown;
};

type VoiceCallHighlightResponse = {
  clips?: Array<{
    title?: unknown;
    quote?: unknown;
    significance?: unknown;
    segmentIndex?: unknown;
    canUseForTitle?: unknown;
  }>;
};

export type VoiceCallTranscriptWord = {
  text: string;
  startMs: number | null;
  endMs: number | null;
};

export type VoiceCallTranscriptSegment = {
  index: number;
  role: TranscriptRole;
  speaker: string;
  content: string;
  startMs: number | null;
  endMs: number | null;
  words: VoiceCallTranscriptWord[];
};

export type ExtractedVoiceCallClip = {
  sortOrder: number;
  title: string;
  quote: string;
  significance: string | null;
  speaker: string;
  startMs: number | null;
  endMs: number | null;
  canUseForTitle: boolean;
};

const VOICE_CALL_HIGHLIGHT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['clips'],
  properties: {
    clips: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'quote', 'significance', 'segmentIndex', 'canUseForTitle'],
        properties: {
          title: { type: 'string' },
          quote: { type: 'string' },
          significance: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          segmentIndex: { type: 'number' },
          canUseForTitle: { type: 'boolean' },
        },
      },
    },
  },
} as const;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toMs(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.round(value * 1000));
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSpeakerPrefix(value: string) {
  return value.replace(/^(agent|assistant|ember|ai|user|caller|contributor|guest|owner)\s*:\s*/i, '').trim();
}

function parseTranscriptRole(value: unknown): TranscriptRole | null {
  return value === 'agent' || value === 'user' || value === 'transfer_target'
    ? value
    : null;
}

function findSegmentTextMatch(segment: VoiceCallTranscriptSegment, quote: string) {
  const normalizedQuote = normalizeForMatch(quote);
  const normalizedSegment = normalizeForMatch(segment.content);
  return normalizedQuote.length > 0 && normalizedSegment.includes(normalizedQuote);
}

function findQuoteTimingInSegment(segment: VoiceCallTranscriptSegment, quote: string) {
  if (segment.words.length === 0) {
    return {
      startMs: segment.startMs,
      endMs: segment.endMs,
    };
  }

  const quoteTokens = normalizeForMatch(quote).split(' ').filter(Boolean);
  const wordTokens = segment.words.map((word) => normalizeForMatch(word.text));

  if (quoteTokens.length === 0) {
    return {
      startMs: segment.startMs,
      endMs: segment.endMs,
    };
  }

  for (let startIndex = 0; startIndex <= wordTokens.length - quoteTokens.length; startIndex += 1) {
    const matches = quoteTokens.every(
      (token, offset) => wordTokens[startIndex + offset] === token
    );

    if (!matches) {
      continue;
    }

    const firstWord = segment.words[startIndex];
    const lastWord = segment.words[startIndex + quoteTokens.length - 1];

    return {
      startMs: firstWord.startMs ?? segment.startMs,
      endMs: lastWord.endMs ?? segment.endMs,
    };
  }

  return {
    startMs: segment.startMs,
    endMs: segment.endMs,
  };
}

export function parseVoiceCallTranscriptSegments({
  transcript,
  transcriptObjectJson,
  contributorName,
}: {
  transcript: string | null | undefined;
  transcriptObjectJson: string | null | undefined;
  contributorName: string;
}) {
  const speakerName = contributorName.trim() || 'Contributor';

  if (transcriptObjectJson) {
    try {
      const parsed = JSON.parse(transcriptObjectJson) as unknown;
      const segments = asArray<RawTranscriptSegment>(parsed)
        .flatMap((item, index) => {
          const role = parseTranscriptRole(item?.role);
          const content =
            typeof item?.content === 'string' ? normalizeText(item.content) : '';

          if (!role || !content) {
            return [];
          }

          const words = asArray<RawTranscriptWord>(item?.words)
            .map((word) => ({
              text: typeof word?.word === 'string' ? normalizeText(word.word) : '',
              startMs: toMs(word?.start),
              endMs: toMs(word?.end),
            }))
            .filter((word) => word.text);

          return [
            {
              index,
              role,
              speaker: role === 'agent' ? 'Ember' : speakerName,
              content,
              startMs:
                words.find((word) => typeof word.startMs === 'number')?.startMs ?? null,
              endMs:
                [...words].reverse().find((word) => typeof word.endMs === 'number')?.endMs ??
                null,
              words,
            } satisfies VoiceCallTranscriptSegment,
          ];
        })
        .filter((segment) => segment.content);

      if (segments.length > 0) {
        return segments;
      }
    } catch {
      // Fall back to transcript text parsing below.
    }
  }

  const fallbackTranscript = normalizeText(transcript || '');
  if (!fallbackTranscript) {
    return [] as VoiceCallTranscriptSegment[];
  }

  return fallbackTranscript
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .map((line, index) => {
      const lowered = line.toLowerCase();
      let role: TranscriptRole = 'user';
      if (lowered.startsWith('agent:') || lowered.startsWith('assistant:') || lowered.startsWith('ember:')) {
        role = 'agent';
      }

      return {
        index,
        role,
        speaker: role === 'agent' ? 'Ember' : speakerName,
        content: stripSpeakerPrefix(line),
        startMs: null,
        endMs: null,
        words: [],
      } satisfies VoiceCallTranscriptSegment;
    });
}

export async function extractImportantVoiceCallClips({
  imageTitle,
  contributorName,
  transcript,
  segments,
}: {
  imageTitle: string;
  contributorName: string;
  transcript: string;
  segments: VoiceCallTranscriptSegment[];
}) {
  const normalizedTranscript = normalizeText(transcript);
  if (!normalizedTranscript || segments.length === 0) {
    return [] as ExtractedVoiceCallClip[];
  }

  const openai = getOpenAIClient();
  const segmentList = segments
    .slice(0, 80)
    .map((segment) => ({
      index: segment.index,
      speaker: segment.speaker,
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: segment.content,
    }));
  const prompt = await renderPromptTemplate('ember_voice.style', '', {
    task: 'clip_extract',
    imageTitle,
    contributorName,
    transcript: '',
    segmentList: JSON.stringify(segmentList, null, 2),
  });

  const response = await openai.responses.create({
    model: await getConfiguredOpenAIModel('voice.clip_extract', getWikiStructureModel()),
    input: [
      {
        role: 'developer',
        type: 'message',
        content: [
          {
            type: 'input_text',
            text: prompt,
          },
        ],
      },
    ],
    text: {
      verbosity: 'low',
      format: {
        type: 'json_schema',
        name: 'voice_call_clips',
        description: 'Clip-worthy highlights extracted from a voice interview.',
        schema: VOICE_CALL_HIGHLIGHT_SCHEMA,
        strict: false,
      },
    },
  });

  const parsed = JSON.parse(response.output_text || '{}') as VoiceCallHighlightResponse;
  const seenQuotes = new Set<string>();

  return asArray<NonNullable<VoiceCallHighlightResponse['clips']>[number]>(parsed.clips)
    .flatMap((clip, sortOrder) => {
      const title = typeof clip?.title === 'string' ? normalizeText(clip.title) : '';
      const rawQuote = typeof clip?.quote === 'string' ? normalizeText(clip.quote) : '';
      const significance =
        typeof clip?.significance === 'string' ? normalizeText(clip.significance) : null;
      const segmentIndex =
        typeof clip?.segmentIndex === 'number' && Number.isFinite(clip.segmentIndex)
          ? clip.segmentIndex
          : -1;
      const segment = segments.find((item) => item.index === segmentIndex);

      if (!title || !rawQuote || !segment) {
        return [];
      }

      const quote = findSegmentTextMatch(segment, rawQuote) ? rawQuote : segment.content;
      const quoteKey = quote.toLowerCase();
      if (seenQuotes.has(quoteKey)) {
        return [];
      }

      seenQuotes.add(quoteKey);
      const timing = findQuoteTimingInSegment(segment, quote);

      return [
        {
          sortOrder,
          title,
          quote,
          significance,
          speaker: segment.speaker,
          startMs: timing.startMs,
          endMs: timing.endMs,
          canUseForTitle: clip?.canUseForTitle === true,
        } satisfies ExtractedVoiceCallClip,
      ];
    })
    .slice(0, 3);
}
