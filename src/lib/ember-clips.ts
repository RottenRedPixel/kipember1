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

// ── Constants ─────────────────────────────────────────────────────────────────

/** Audio clips shorter than this are useless for playback — the LLM tends to
 *  pull single-word fragments ("disappointment") that work as factual claims
 *  but sound absurd when played as audio. Clips are validated against this
 *  threshold at every extraction point (LLM output, claim-sync fallback). */
const MIN_CLIP_WORDS = 4;

function hasMinWords(quote: string): boolean {
  return quote.trim().split(/\s+/).filter(Boolean).length >= MIN_CLIP_WORDS;
}

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

function findQuoteTimingInSegment(
  segment: TranscriptSegment,
  quote: string,
): { startMs: number; endMs: number } | null {
  if (segment.words.length === 0) return null;

  const quoteTokens = normalizeForMatch(quote).split(' ').filter(Boolean);
  const wordTokens = segment.words.map((w) => normalizeForMatch(w.text));

  if (quoteTokens.length === 0) return null;

  for (let i = 0; i <= wordTokens.length - quoteTokens.length; i++) {
    if (quoteTokens.every((token, offset) => wordTokens[i + offset] === token)) {
      const startMs = segment.words[i].startMs ?? segment.startMs;
      const endMs = segment.words[i + quoteTokens.length - 1].endMs ?? segment.endMs;
      if (startMs === null || endMs === null) return null;
      return { startMs, endMs };
    }
  }
  // Strict verbatim: no match → no clip. We refuse to fall back to the
  // segment's whole bounds, because that produced clips whose displayed quote
  // was the LLM's paraphrase but whose audio played the start of an unrelated
  // turn (typically "Hello?" / "Yeah").
  return null;
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

const CLIP_EXTRACTION_SYSTEM = `You are extracting audio clips from a memory recording. Create one clip for EVERY distinct sentence or thought the contributor expresses — this is mandatory, not optional.

Work through the CONTRIBUTOR's words sentence by sentence. For EACH sentence or distinct thought, create a clip:

Significance categories (pick the best fit):
- "why"     — a reason, motivation, or what the moment means to them
- "emotion" — a feeling or emotional state
- "story"   — something that happened, what someone was doing, an anecdote, a description
- "place"   — a location or place mentioned
- "person"  — describing someone: their name, appearance, actions, or role

Every sentence counts. Examples:
- "He was wearing an orange t-shirt" → person clip
- "She was laughing the whole time" → emotion clip
- "They were doing their homework" → story clip
- "It meant everything to me" → why clip

Return JSON: {"clips": [{"title": "short label (3–6 words)", "quote": "exact verbatim words from transcript", "significance": "why / emotion / story / place / person", "segmentIndex": 0, "canUseForTitle": false}]}

Rules:
- quote must be verbatim — never paraphrase or summarise
- quote must be at least 4 words — single words or short fragments are NOT valid clips; they work as facts but sound absurd when played as audio
- one clip per sentence/thought — do not merge multiple sentences into one clip
- canUseForTitle: true only if the quote could stand alone as an ember title
- Return {"clips": []} only if the contributor said absolutely nothing`;

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
    if (!quote || !hasMinWords(quote)) return [];

    const segIdx = typeof clip.segmentIndex === 'number' ? clip.segmentIndex : -1;
    const segment = segments.find((s) => s.index === segIdx && s.role === 'user')
      ?? contributorSegments.find((s) => s.content.toLowerCase().includes(normalizeForMatch(quote).split(' ')[0] ?? ''));

    if (!segment) return [];
    const timing = findQuoteTimingInSegment(segment, quote);
    // Strict verbatim: drop the clip if the quote isn't a contiguous token
    // sequence in the picked segment. Mirrors the voice extractor's behavior.
    if (!timing) return [];

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
    if (!quote || !hasMinWords(quote) || words.length === 0) return [];

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
  if (words.length === 0) {
    console.log(`[EmberVoiceClip] No word timestamps for message ${emberMessageId} — skipping clip extraction (need whisper-1)`);
    return;
  }

  const extracted = await extractImportantEmberVoiceClips({ emberTitle, speakerName, transcript, words });
  console.log(`[EmberVoiceClip] LLM extracted ${extracted.length} clip(s) for message ${emberMessageId}`);
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
        console.log(`[EmberVoiceClip] Saved clip "${clip.title}" (${clip.startMs}–${clip.endMs}ms) as ${clipFilename}`);
      } catch (err) {
        console.error(`[EmberVoiceClip] Failed to extract/upload clip "${clip.title}":`, err);
        return null;
      }
      return { ...clip, clipFilename };
    })
  );

  const valid = clips.filter((c): c is NonNullable<typeof c> => c !== null);
  console.log(`[EmberVoiceClip] ${valid.length}/${extracted.length} clips saved to DB for message ${emberMessageId}`);
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

// ── Claim-to-clip sync (deprecated, no-op) ───────────────────────────────────
// Previously this filled "gaps" the LLM clip extractor missed by saving a
// clip whose displayed quote was the claim's distilled paraphrase and whose
// audio window was a fuzzy/partial-token match against the recording. That
// presented an LLM paraphrase as if it were a verbatim recording. Replaced by
// rendering claims with verbatim source rows pulled from the original
// EmberMessage / VoiceCall transcript instead of synthesizing new clips.
export async function syncVoiceClipsFromClaims(_args: {
  emberId: string;
  emberContributorId: string | null;
  emberMessageId: string;
  speakerName: string;
  audioFilename: string;
  transcriptObjectJson: string | null;
}): Promise<void> {
  return;
}

