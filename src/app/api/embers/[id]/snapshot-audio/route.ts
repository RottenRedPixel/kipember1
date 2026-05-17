import { createHash } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
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

const execFileAsync = promisify(execFile);
const FFPROBE_BINARY = process.env.FFPROBE_PATH || 'ffprobe';

/** Returns the duration of an audio file in milliseconds via ffprobe. */
async function probeAudioDurationMs(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(FFPROBE_BINARY, [
      '-v', 'error',
      '-print_format', 'json',
      '-show_entries', 'format=duration',
      filePath,
    ]);
    const parsed = JSON.parse(stdout) as { format?: { duration?: string } };
    const secs = parseFloat(parsed.format?.duration ?? '0');
    return Number.isFinite(secs) ? Math.round(secs * 1000) : 0;
  } catch {
    return 0;
  }
}

const STORY_CUT_AUDIO_RENDER_VERSION = 'v2';

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

export type SegmentDuration = { order: number; durationMs: number };

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
}): Promise<{ outputPath: string; segmentDurations: SegmentDuration[] }> {
  const cacheKey = createHash('sha1').update(JSON.stringify(cachePayload)).digest('hex');
  const renderDir = join(getUploadsDir(), '.snapshot-renders');
  const outputPath = join(renderDir, `${cacheKey}.m4a`);
  const durationsPath = join(renderDir, `${cacheKey}.durations.json`);

  await fs.mkdir(renderDir, { recursive: true });

  // Cache hit — return cached audio + cached durations (if available).
  try {
    await fs.access(outputPath);
    const durJson = await fs.readFile(durationsPath, 'utf8').catch(() => '[]');
    const segmentDurations = JSON.parse(durJson) as SegmentDuration[];
    return { outputPath, segmentDurations };
  } catch {
    // render below
  }

  const playbackBlocks =
    blocks.length > 0
      ? blocks
      : [
          {
            type: 'voice' as const,
            content: fallbackScript,
            order: 1,
          },
        ];

  // Track { order, path } so we can probe each segment's actual duration.
  const segmentEntries: { order: number; path: string }[] = [];

  for (const block of playbackBlocks) {
    if (isVoiceBlock(block)) {
      const line = block.content?.trim() || '';
      if (!line) continue;
      const path = await getOrCreateTtsSegmentPath({ text: line, voiceId });
      segmentEntries.push({ order: block.order ?? 0, path });
      continue;
    }

    if (!isMediaBlock(block) || !block.mediaId) continue;
    if (block.mediaType && block.mediaType !== 'AUDIO') continue;

    const clipStartMs =
      typeof block.clipStartMs === 'number' && Number.isFinite(block.clipStartMs)
        ? block.clipStartMs
        : null;
    const clipEndMs =
      typeof block.clipEndMs === 'number' && Number.isFinite(block.clipEndMs)
        ? block.clipEndMs
        : null;

    try {
      let path: string;
      if (clipStartMs != null && clipEndMs != null && clipEndMs > clipStartMs) {
        path = await getOrCreateAudioSegmentPath({
          emberId,
          mediaId: block.mediaId,
          startMs: clipStartMs,
          endMs: clipEndMs,
        });
      } else {
        path = await getOrCreateNormalizedAudioPath({ emberId, mediaId: block.mediaId });
      }
      segmentEntries.push({ order: block.order ?? 0, path });
    } catch (segmentError) {
      console.error('Skipping non-playable story cut media block:', segmentError);
    }
  }

  if (segmentEntries.length === 0) {
    throw new Error('Story Cut has no playable audio blocks');
  }

  // Probe each segment's actual duration so the client can sync text accurately.
  const segmentDurations: SegmentDuration[] = await Promise.all(
    segmentEntries.map(async ({ order, path }) => ({
      order,
      durationMs: await probeAudioDurationMs(path),
    }))
  );

  await concatenateAudioSegmentsToM4a({
    inputPaths: segmentEntries.map((e) => e.path),
    outputPath,
  });

  // Cache durations alongside the audio file.
  await fs.writeFile(durationsPath, JSON.stringify(segmentDurations)).catch(() => undefined);

  return { outputPath, segmentDurations };
}

async function getOrCreateTtsSegmentPath({
  text,
  voiceId,
}: {
  text: string;
  voiceId: string;
}) {
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) {
    throw new Error('ElevenLabs is not configured for narration.');
  }

  const speechText = normalizeTextForSpeech(text);
  const cacheKey = createHash('sha1')
    .update(`${voiceId}:${getElevenLabsModelId()}:${speechText}`)
    .digest('hex');
  const segmentDir = join(getUploadsDir(), '.snapshot-tts');
  const outputPath = join(segmentDir, `${cacheKey}.m4a`);
  const tempMp3Path = join(segmentDir, `${cacheKey}.mp3`);

  await fs.mkdir(segmentDir, { recursive: true });

  try {
    await fs.access(outputPath);
    return outputPath;
  } catch {
    // fall through
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      Accept: 'audio/mpeg',
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
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || 'Failed to generate story cut narration');
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(tempMp3Path, audioBuffer);

  try {
    await transcodeAudioToM4a({
      inputPath: tempMp3Path,
      outputPath,
    });
  } finally {
    await fs.unlink(tempMp3Path).catch(() => undefined);
  }

  return outputPath;
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
    const { outputPath, segmentDurations } = await renderSnapshotAudio({
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

    const stat = await fs.stat(outputPath);
    const stream = createReadStream(outputPath);

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        'Content-Type': 'audio/mp4',
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, max-age=3600',
        'X-Segment-Durations': JSON.stringify(segmentDurations),
        'Access-Control-Expose-Headers': 'X-Segment-Durations',
      },
    });
  } catch (error) {
    console.error('Story Cut audio render error:', error);
    return NextResponse.json({ error: 'Failed to prepare story cut audio' }, { status: 500 });
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

    const { outputPath, segmentDurations } = await renderSnapshotAudio({
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

    const stat = await fs.stat(outputPath);
    const stream = createReadStream(outputPath);

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        'Content-Type': 'audio/mp4',
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, max-age=3600',
        'X-Segment-Durations': JSON.stringify(segmentDurations),
        'Access-Control-Expose-Headers': 'X-Segment-Durations',
      },
    });
  } catch (error) {
    console.error('Draft Story Cut audio render error:', error);
    return NextResponse.json({ error: 'Failed to prepare story cut audio' }, { status: 500 });
  }
}
