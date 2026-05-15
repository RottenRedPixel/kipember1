import { chat } from '@/lib/claude';
import { prisma } from '@/lib/db';
import { getUploadPath, getUploadUrl } from '@/lib/uploads';
import { uploadLocalFileToObjectStorage } from '@/lib/object-storage';
import { extractAudioClipToM4a } from '@/lib/audio-processing';
import { randomUUID } from 'crypto';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { getUploadsDir } from '@/lib/uploads';

// ── Shared transcript types ──────────────────────────────────────────────────

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

export type TranscriptWord = {
  text: string;
  startMs: number | null;
  endMs: number | null;
};

export type TranscriptSegment = {
  index: number;
  role: TranscriptRole;
  speaker: string;
  content: string;
  startMs: number | null;
  endMs: number | null;
  words: TranscriptWord[];
};

// ── Extracted clip shape (shared) ────────────────────────────────────────────

export type ExtractedEmberCallClip = {
  sortOrder: number;
  title: string;
  quote: string;
  significance: string | null;
  speaker: string;
  startMs: number | null;
  endMs: number | null;
  canUseForTitle: boolean;
};

export type ExtractedEmberVoiceClip = {
  sortOrder: number;
  title: string;
  quote: string;
  significance: string | null;
  startMs: number;
  endMs: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toMs(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value * 1000));
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripSpeakerPrefix(value: string) {
  return value.replace(/^(agent|assistant|ember|ai|user|caller|contributor|guest|owner)\s*:\s*/i, '').trim();
}

function parseTranscriptRole(value: unknown): TranscriptRole | null {
  return value === 'agent' || value === 'user' || value === 'transfer_target' ? value : null;
}

function findQuoteTimingInSegment(segment: TranscriptSegment, quote: string) {
  if (segment.words.length === 0) return { startMs: segment.startMs, endMs: segment.endMs };

  const quoteTokens = normalizeForMatch(quote).split(' ').filter(Boolean);
  const wordTokens = segment.words.map((w) => normalizeForMatch(w.text));

  if (quoteTokens.length === 0) return { startMs: segment.startMs, endMs: segment.endMs };

  for (let i = 0; i <= wordTokens.length - quoteTokens.length; i++) {
    if (quoteTokens.every((token, offset) => wordTokens[i + offset] === token)) {
      return {
        startMs: segment.words[i].startMs ?? segment.startMs,
        endMs: segment.words[i + quoteTokens.length - 1].endMs ?? segment.endMs,
      };
    }
  }
  return { startMs: segment.startMs, endMs: segment.endMs };
}

// ── EmberCall transcript parser (from Retell transcriptObjectJson) ────────────

export function parseCallTranscriptSegments({
  transcript,
  transcriptObjectJson,
  contributorName,
}: {
  transcript: string | null | undefined;
  transcriptObjectJson: string | null | undefined;
  contributorName: string;
}): TranscriptSegment[] {
  const speakerName = contributorName.trim() || 'Contributor';

  if (transcriptObjectJson) {
    try {
      const parsed = JSON.parse(transcriptObjectJson) as unknown;
      const segments = asArray<RawTranscriptSegment>(parsed).flatMap((item, index) => {
        const role = parseTranscriptRole(item?.role);
        const content = typeof item?.content === 'string' ? normalizeText(item.content) : '';
        if (!role || !content) return [];

        const words = asArray<RawTranscriptWord>(item?.words)
          .map((word) => ({
            text: typeof word?.word === 'string' ? normalizeText(word.word) : '',
            startMs: toMs(word?.start),
            endMs: toMs(word?.end),
          }))
          .filter((w) => w.text);

        return [{
          index,
          role,
          speaker: role === 'agent' ? 'Ember' : speakerName,
          content,
          startMs: words.find((w) => typeof w.startMs === 'number')?.startMs ?? null,
          endMs: [...words].reverse().find((w) => typeof w.endMs === 'number')?.endMs ?? null,
          words,
        } satisfies TranscriptSegment];
      }).filter((s) => s.content);

      if (segments.length > 0) return segments;
    } catch { /* fall through */ }
  }

  const fallback = normalizeText(transcript || '');
  if (!fallback) return [];

  return fallback.split(/\n+/).map(normalizeText).filter(Boolean).map((line, index) => {
    const role: TranscriptRole =
      /^(agent|assistant|ember):/i.test(line) ? 'agent' : 'user';
    return {
      index,
      role,
      speaker: role === 'agent' ? 'Ember' : speakerName,
      content: stripSpeakerPrefix(line),
      startMs: null,
      endMs: null,
      words: [],
    } satisfies TranscriptSegment;
  });
}

// ── EmberVoice word array parser (from Whisper transcriptObjectJson) ──────────

export function parseVoiceMessageWords(transcriptObjectJson: string | null | undefined): TranscriptWord[] {
  if (!transcriptObjectJson) return [];
  try {
    const parsed = JSON.parse(transcriptObjectJson) as unknown;
    return asArray<{ word?: unknown; startMs?: unknown; endMs?: unknown }>(parsed)
      .map((w) => ({
        text: typeof w?.word === 'string' ? normalizeText(w.word) : '',
        startMs: typeof w?.startMs === 'number' ? w.startMs : null,
        endMs: typeof w?.endMs === 'number' ? w.endMs : null,
      }))
      .filter((w) => w.text);
  } catch {
    return [];
  }
}

// ── Clip extraction prompt ────────────────────────────────────────────────────

const CLIP_EXTRACTION_SYSTEM = `You are extracting memorable voice quotes from a memory conversation.

Find 1–3 short quotes from the CONTRIBUTOR (not from Ember/agent) that are:
- Vivid, specific, and personal — a detail only they would know
- Emotionally resonant — joy, pride, tenderness, surprise
- Complete thoughts — not mid-sentence fragments

Return JSON: {"clips": [{"title": "short label", "quote": "exact words spoken", "significance": "why this matters", "segmentIndex": 0, "canUseForTitle": false}]}

Rules:
- quote must be verbatim from the transcript — do not paraphrase
- canUseForTitle: true only if the quote could stand alone as an ember title
- Return {"clips": []} if nothing qualifies`;

// ── EmberCall clip extractor ──────────────────────────────────────────────────

export async function extractImportantEmberCallClips({
  emberTitle,
  contributorName,
  segments,
}: {
  emberTitle: string;
  contributorName: string;
  segments: TranscriptSegment[];
}): Promise<ExtractedEmberCallClip[]> {
  const contributorSegments = segments.filter((s) => s.role === 'user');
  if (contributorSegments.length === 0) return [];

  const transcriptText = segments
    .map((s) => `[${s.speaker}]: ${s.content}`)
    .join('\n');

  const userMessage = `Ember title: ${emberTitle}\nContributor: ${contributorName}\n\nTranscript:\n${transcriptText}`;

  let raw: string;
  try {
    raw = await chat(CLIP_EXTRACTION_SYSTEM, [{ role: 'user', content: userMessage }]);
  } catch {
    return [];
  }

  let parsed: { clips?: unknown[] };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] ?? '{}') as { clips?: unknown[] };
  } catch {
    return [];
  }

  const clips = asArray<{
    title?: unknown; quote?: unknown; significance?: unknown;
    segmentIndex?: unknown; canUseForTitle?: unknown;
  }>(parsed?.clips);

  return clips.flatMap((clip, i) => {
    const quote = typeof clip.quote === 'string' ? normalizeText(clip.quote) : '';
    const title = typeof clip.title === 'string' ? normalizeText(clip.title) : quote.slice(0, 60);
    if (!quote) return [];

    const segIdx = typeof clip.segmentIndex === 'number' ? clip.segmentIndex : -1;
    const segment = segments.find((s) => s.index === segIdx && s.role === 'user')
      ?? contributorSegments.find((s) => s.content.toLowerCase().includes(normalizeForMatch(quote).split(' ')[0] ?? ''));

    const timing = segment ? findQuoteTimingInSegment(segment, quote) : { startMs: null, endMs: null };

    return [{
      sortOrder: i,
      title,
      quote,
      significance: typeof clip.significance === 'string' ? clip.significance : null,
      speaker: contributorName,
      startMs: timing.startMs,
      endMs: timing.endMs,
      canUseForTitle: clip.canUseForTitle === true,
    }];
  });
}

// ── EmberVoice clip extractor ────────────────────────────────────────────────

export async function extractImportantEmberVoiceClips({
  emberTitle,
  speakerName,
  transcript,
  words,
}: {
  emberTitle: string;
  speakerName: string;
  transcript: string;
  words: TranscriptWord[];
}): Promise<ExtractedEmberVoiceClip[]> {
  if (!transcript.trim()) return [];

  const userMessage = `Ember title: ${emberTitle}\nSpeaker: ${speakerName}\n\nTranscript:\n[${speakerName}]: ${transcript}`;

  let raw: string;
  try {
    raw = await chat(CLIP_EXTRACTION_SYSTEM, [{ role: 'user', content: userMessage }]);
  } catch {
    return [];
  }

  let parsed: { clips?: unknown[] };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] ?? '{}') as { clips?: unknown[] };
  } catch {
    return [];
  }

  const clips = asArray<{
    title?: unknown; quote?: unknown; significance?: unknown; canUseForTitle?: unknown;
  }>(parsed?.clips);

  // For voice messages, find timing directly in the flat word array
  return clips.flatMap((clip, i) => {
    const quote = typeof clip.quote === 'string' ? normalizeText(clip.quote) : '';
    const title = typeof clip.title === 'string' ? normalizeText(clip.title) : quote.slice(0, 60);
    if (!quote || words.length === 0) return [];

    const quoteTokens = normalizeForMatch(quote).split(' ').filter(Boolean);
    const wordTokens = words.map((w) => normalizeForMatch(w.text));

    let startMs: number | null = null;
    let endMs: number | null = null;

    for (let j = 0; j <= wordTokens.length - quoteTokens.length; j++) {
      if (quoteTokens.every((token, offset) => wordTokens[j + offset] === token)) {
        startMs = words[j].startMs;
        endMs = words[j + quoteTokens.length - 1].endMs;
        break;
      }
    }

    // Require timing — no timing means we can't make a clip
    if (startMs === null || endMs === null) return [];

    return [{
      sortOrder: i,
      title,
      quote,
      significance: typeof clip.significance === 'string' ? clip.significance : null,
      startMs,
      endMs,
    }];
  });
}

// ── Persist EmberVoiceClip (extract + upload segment file) ───────────────────

export async function persistEmberVoiceClips({
  emberId,
  emberContributorId,
  emberMessageId,
  emberTitle,
  speakerName,
  transcript,
  audioFilename,
  transcriptObjectJson,
}: {
  emberId: string;
  emberContributorId: string | null;
  emberMessageId: string;
  emberTitle: string;
  speakerName: string;
  transcript: string;
  audioFilename: string;
  transcriptObjectJson: string | null;
}): Promise<void> {
  const words = parseVoiceMessageWords(transcriptObjectJson);
  const extracted = await extractImportantEmberVoiceClips({ emberTitle, speakerName, transcript, words });
  if (extracted.length === 0) return;

  const segmentsDir = join(getUploadsDir(), '.segments');
  await mkdir(segmentsDir, { recursive: true });

  const sourcePath = getUploadPath(audioFilename);

  const clips = await Promise.all(
    extracted.map(async (clip) => {
      const clipFilename = `${randomUUID()}.m4a`;
      const clipPath = join(segmentsDir, clipFilename);
      try {
        await extractAudioClipToM4a({ input: sourcePath, outputPath: clipPath, startMs: clip.startMs, endMs: clip.endMs });
        await uploadLocalFileToObjectStorage({ filename: clipFilename, filePath: clipPath });
      } catch {
        return null;
      }
      return { ...clip, clipFilename };
    })
  );

  const valid = clips.filter((c): c is NonNullable<typeof c> => c !== null);
  if (valid.length === 0) return;

  await prisma.emberVoiceClip.deleteMany({ where: { emberMessageId } });
  await prisma.emberVoiceClip.createMany({
    data: valid.map((clip) => ({
      emberId,
      emberContributorId: emberContributorId ?? undefined,
      emberMessageId,
      sortOrder: clip.sortOrder,
      title: clip.title,
      quote: clip.quote,
      significance: clip.significance,
      speaker: speakerName,
      audioFilename: clip.clipFilename,
      startMs: clip.startMs,
      endMs: clip.endMs,
    })),
  });
}
