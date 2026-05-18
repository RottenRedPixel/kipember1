import { createHash } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import {
  concatenateAudioSegmentsToM4a,
  transcodeAudioToM4a,
} from '@/lib/audio-processing';
import { getOrCreateAudioSegmentPath, getOrCreateNormalizedAudioPath } from '@/lib/audio-segments';
import { getElevenLabsApiKey, getElevenLabsModelId } from '@/lib/elevenlabs';
import { getEmberAccessType } from '@/lib/ember';
import { prisma } from '@/lib/db';
import { normalizeTextForSpeech } from '@/lib/narration';
import { getUploadsDir } from '@/lib/uploads';
import { getVoiceEntry } from '@/lib/voice-catalog';

const STORY_CUT_AUDIO_RENDER_VERSION = 'v4'; // v4: with-timestamps TTS + word sidecar

// Per-word timing for the rendered narration. Karaoke captions in the
// StoriesOverlay use this to highlight the word currently being spoken.
type WordTiming = { text: string; startMs: number; endMs: number };

function groupCharactersToWords(alignment: {
  characters?: unknown;
  character_start_times_seconds?: unknown;
  character_end_times_seconds?: unknown;
}): WordTiming[] {
  const chars = Array.isArray(alignment.characters) ? alignment.characters as unknown[] : [];
  const starts = Array.isArray(alignment.character_start_times_seconds) ? alignment.character_start_times_seconds as unknown[] : [];
  const ends = Array.isArray(alignment.character_end_times_seconds) ? alignment.character_end_times_seconds as unknown[] : [];
  if (chars.length === 0 || chars.length !== starts.length || chars.length !== ends.length) return [];

  const words: WordTiming[] = [];
  let current: { text: string; startMs: number; endMs: number } | null = null;
  for (let i = 0; i < chars.length; i++) {
    const ch = typeof chars[i] === 'string' ? (chars[i] as string) : '';
    const s = typeof starts[i] === 'number' ? Math.round((starts[i] as number) * 1000) : null;
    const e = typeof ends[i] === 'number' ? Math.round((ends[i] as number) * 1000) : null;
    if (!ch) continue;

    const isSpace = /\s/.test(ch);
    if (isSpace) {
      if (current) {
        words.push(current);
        current = null;
      }
      continue;
    }
    if (!current) {
      current = { text: ch, startMs: s ?? 0, endMs: e ?? s ?? 0 };
    } else {
      current.text += ch;
      if (e !== null) current.endMs = e;
    }
  }
  if (current) words.push(current);
  return words;
}

// Returns true when the token is a valid contributor token OR the ember's
// share token for the given emberId. Used by both GET and POST so guests
// and share-link viewers can access audio on all badges.
async function tokenAllowsAccess(token: string, emberId: string): Promise<boolean> {
  const [contributor, ember] = await Promise.all([
    prisma.emberContributor.findUnique({ where: { token }, select: { emberId: true } }),
    prisma.ember.findUnique({ where: { shareToken: token }, select: { id: true } }),
  ]);
  return (
    (contributor?.emberId === emberId) ||
    (ember?.id === emberId)
  );
}

type SnapshotBlock =
  | {
      type: 'voice';
      speaker?: string | null;
      content?: string | null;
      order?: number | null;
    }
  | {
      type: 'media';
      mediaId?: string | null;
      mediaUrl?: string | null;
      mediaType?: string | null;
      clipStartMs?: number | null;
      clipEndMs?: number | null;
      order?: number | null;
    };

function isVoiceBlock(block: SnapshotBlock): block is Extract<SnapshotBlock, { type: 'voice' }> {
  return block.type === 'voice';
}

function isMediaBlock(block: SnapshotBlock): block is Extract<SnapshotBlock, { type: 'media' }> {
  return block.type === 'media';
}

async function renderSnapshotAudio({
  emberId,
  blocks,
  voiceId,
  cachePayload,
  fallbackScript,
}: {
  emberId: string;
  blocks: SnapshotBlock[];
  voiceId: string;
  cachePayload: unknown;
  fallbackScript: string;
}): Promise<string> {
  const cacheKey = createHash('sha1').update(JSON.stringify(cachePayload)).digest('hex');
  const renderDir = join(getUploadsDir(), '.snapshot-renders');
  const outputPath = join(renderDir, `${cacheKey}.m4a`);

  await fs.mkdir(renderDir, { recursive: true });

  try {
    await fs.access(outputPath);
    return outputPath;
  } catch {
    // render below
  }

  const playbackBlocks =
    blocks.length > 0
      ? blocks
      : [{ type: 'voice' as const, content: fallbackScript, order: 1 }];

  const segmentPaths: string[] = [];
  const segmentWords: Array<{ words: WordTiming[]; durationMs: number }> = [];

  for (const block of playbackBlocks) {
    if (isVoiceBlock(block)) {
      const line = block.content?.trim() || '';
      if (!line) continue;
      const { audioPath, words } = await getOrCreateTtsSegmentPath({ text: line, voiceId });
      segmentPaths.push(audioPath);
      // Segment duration = last word's endMs. If timings are missing we still
      // play the audio, we just lose word-sync for that segment.
      const durationMs = words.length > 0 ? words[words.length - 1].endMs : 0;
      segmentWords.push({ words, durationMs });
      continue;
    }

    if ((block as { type: string }).type === 'emberpause') continue; // client-side silence
    if (!isMediaBlock(block) || !block.mediaId) continue;
    if (block.mediaType && block.mediaType !== 'AUDIO') continue;

    const clipStartMs =
      typeof block.clipStartMs === 'number' && Number.isFinite(block.clipStartMs)
        ? block.clipStartMs : null;
    const clipEndMs =
      typeof block.clipEndMs === 'number' && Number.isFinite(block.clipEndMs)
        ? block.clipEndMs : null;

    try {
      if (clipStartMs != null && clipEndMs != null && clipEndMs > clipStartMs) {
        segmentPaths.push(await getOrCreateAudioSegmentPath({
          emberId, mediaId: block.mediaId, startMs: clipStartMs, endMs: clipEndMs,
        }));
        segmentWords.push({ words: [], durationMs: Math.max(0, clipEndMs - clipStartMs) });
      } else {
        segmentPaths.push(await getOrCreateNormalizedAudioPath({ emberId, mediaId: block.mediaId }));
        segmentWords.push({ words: [], durationMs: 0 });
      }
    } catch (segmentError) {
      console.error(
        `Skipping non-playable media block (mediaId=${block.mediaId}, startMs=${clipStartMs}, endMs=${clipEndMs}):`,
        segmentError instanceof Error ? segmentError.message : segmentError,
      );
    }
  }

  if (segmentPaths.length === 0) {
    throw new Error('No playable audio blocks — all media segments failed to resolve');
  }

  await concatenateAudioSegmentsToM4a({ inputPaths: segmentPaths, outputPath });

  // Unified word timings across all segments. Offsets each segment's words by
  // the cumulative duration of preceding segments so the timing references the
  // final concatenated file, not the per-segment file.
  const unified: WordTiming[] = [];
  let offsetMs = 0;
  for (const seg of segmentWords) {
    for (const w of seg.words) {
      unified.push({ text: w.text, startMs: w.startMs + offsetMs, endMs: w.endMs + offsetMs });
    }
    offsetMs += seg.durationMs;
  }
  await fs.writeFile(`${outputPath}.words.json`, JSON.stringify(unified));

  return outputPath;
}

async function getOrCreateTtsSegmentPath({
  text,
  voiceId,
}: {
  text: string;
  voiceId: string;
}): Promise<{ audioPath: string; words: WordTiming[] }> {
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) {
    throw new Error('ElevenLabs is not configured for narration.');
  }

  const speechText = normalizeTextForSpeech(text);
  const cacheKey = createHash('sha1')
    .update(`${voiceId}:${getElevenLabsModelId()}:wts:${speechText}`)
    .digest('hex');
  const segmentDir = join(getUploadsDir(), '.snapshot-tts');
  const outputPath = join(segmentDir, `${cacheKey}.m4a`);
  const wordsPath = join(segmentDir, `${cacheKey}.words.json`);
  const tempMp3Path = join(segmentDir, `${cacheKey}.mp3`);

  await fs.mkdir(segmentDir, { recursive: true });

  try {
    await fs.access(outputPath);
    const cachedWords = await fs
      .readFile(wordsPath, 'utf8')
      .then((text) => JSON.parse(text) as WordTiming[])
      .catch(() => []);
    return { audioPath: outputPath, words: cachedWords };
  } catch {
    // fall through to render
  }

  // ElevenLabs `/with-timestamps` returns JSON: { audio_base64, alignment: {
  // characters, character_start_times_seconds, character_end_times_seconds } }.
  // We use the alignment to derive per-word timings for karaoke captions.
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: speechText,
        model_id: getElevenLabsModelId(),
        output_format: 'mp3_44100_128',
        voice_settings: {
          stability: 0.46,
          similarity_boost: 0.76,
          style: 0.28,
          speed: 0.96,
          use_speaker_boost: true,
        },
      }),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || 'Failed to generate story cut narration');
  }

  const payload = (await response.json()) as {
    audio_base64?: string;
    alignment?: {
      characters?: unknown;
      character_start_times_seconds?: unknown;
      character_end_times_seconds?: unknown;
    };
  };

  if (!payload.audio_base64) {
    throw new Error('ElevenLabs with-timestamps response missing audio_base64');
  }

  const audioBuffer = Buffer.from(payload.audio_base64, 'base64');
  await fs.writeFile(tempMp3Path, audioBuffer);

  try {
    await transcodeAudioToM4a({
      inputPath: tempMp3Path,
      outputPath,
    });
  } finally {
    await fs.unlink(tempMp3Path).catch(() => undefined);
  }

  const words = payload.alignment ? groupCharactersToWords(payload.alignment) : [];
  await fs.writeFile(wordsPath, JSON.stringify(words));

  return { audioPath: outputPath, words };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Allow guest access via contributor token or ember share token
    const guestToken = request.nextUrl.searchParams.get('token');
    if (guestToken) {
      if (!(await tokenAllowsAccess(guestToken, id))) {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      }
    } else {
      const auth = await requireApiUser();
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const accessType = await getEmberAccessType(auth.user.id, id);
      if (!accessType) {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      }
    }

    const ember = await prisma.ember.findUnique({
      where: { id },
      select: {
        id: true,
        owner: { select: { voicePreferenceId: true } },
        snapshot: {
          select: {
            id: true,
            script: true,
            blocksJson: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!ember?.snapshot) {
      return NextResponse.json({ error: 'Story Cut not found' }, { status: 404 });
    }

    const snapshot = ember.snapshot;
    const parsedBlocks = JSON.parse(snapshot.blocksJson || '[]');
    const blocks = Array.isArray(parsedBlocks) ? (parsedBlocks as SnapshotBlock[]) : [];
    const sortedBlocks = [...blocks].sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
    const voiceId = getVoiceEntry(ember.owner?.voicePreferenceId).elevenLabsId;
    const outputPath = await renderSnapshotAudio({
      emberId: id,
      blocks: sortedBlocks,
      voiceId,
      fallbackScript: snapshot.script,
      cachePayload: {
        version: STORY_CUT_AUDIO_RENDER_VERSION,
        emberId: id,
        snapshotId: snapshot.id,
        updatedAt: snapshot.updatedAt.toISOString(),
        voiceId,
        blocks: sortedBlocks,
      },
    });

    // When ?timings=1 is set, return the unified word timings JSON for
    // karaoke captions instead of the audio bytes. The render is already
    // complete (cached) so this is just a file read.
    if (request.nextUrl.searchParams.get('timings') === '1') {
      const words = await fs
        .readFile(`${outputPath}.words.json`, 'utf8')
        .then((text) => JSON.parse(text) as WordTiming[])
        .catch(() => []);
      return NextResponse.json({ words });
    }

    const stat = await fs.stat(outputPath);
    const stream = createReadStream(outputPath);

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        'Content-Type': 'audio/mp4',
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Story Cut audio render error:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to prepare story cut audio: ${detail}` }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guestToken = request.nextUrl.searchParams.get('token');
    if (guestToken) {
      if (!(await tokenAllowsAccess(guestToken, id))) {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      }
    } else {
      const auth = await requireApiUser();
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const accessType = await getEmberAccessType(auth.user.id, id);
      if (!accessType) {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      }
    }

    const body = (await request.json().catch(() => null)) as
      | {
          script?: string;
          blocks?: SnapshotBlock[];
        }
      | null;

    const script = typeof body?.script === 'string' ? body.script.trim() : '';
    const blocks = Array.isArray(body?.blocks)
      ? [...body.blocks].sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
      : [];

    const emberOwner = await prisma.ember.findUnique({
      where: { id },
      select: { owner: { select: { voicePreferenceId: true } } },
    });
    const voiceId = getVoiceEntry(emberOwner?.owner?.voicePreferenceId).elevenLabsId;

    if (!script && blocks.length === 0) {
      return NextResponse.json({ error: 'Story Cut has no playable content' }, { status: 400 });
    }

    const outputPath = await renderSnapshotAudio({
      emberId: id,
      blocks,
      voiceId,
      fallbackScript: script,
      cachePayload: {
        version: STORY_CUT_AUDIO_RENDER_VERSION,
        emberId: id,
        draft: true,
        voiceId,
        script,
        blocks,
      },
    });

    if (request.nextUrl.searchParams.get('timings') === '1') {
      const words = await fs
        .readFile(`${outputPath}.words.json`, 'utf8')
        .then((text) => JSON.parse(text) as WordTiming[])
        .catch(() => []);
      return NextResponse.json({ words });
    }

    const stat = await fs.stat(outputPath);
    const stream = createReadStream(outputPath);

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        'Content-Type': 'audio/mp4',
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Draft Story Cut audio render error:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to prepare story cut audio: ${detail}` }, { status: 500 });
  }
}
