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
import { getElevenLabsApiKey, getElevenLabsModelId, resolveNarrationVoice } from '@/lib/elevenlabs';
import { getEmberAccessType } from '@/lib/ember-access';
import { prisma } from '@/lib/db';
import { normalizeTextForSpeech } from '@/lib/narration';
import { getUploadsDir } from '@/lib/uploads';

const STORY_CUT_AUDIO_RENDER_VERSION = 'v2';

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
  imageId,
  blocks,
  voiceId,
  cachePayload,
  fallbackScript,
}: {
  imageId: string;
  blocks: SnapshotBlock[];
  voiceId: string;
  cachePayload: unknown;
  fallbackScript: string;
}) {
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
      : [
          {
            type: 'voice' as const,
            content: fallbackScript,
            order: 1,
          },
        ];

  const segmentPaths: string[] = [];

  for (const block of playbackBlocks) {
    if (isVoiceBlock(block)) {
      const line = block.content?.trim() || '';
      if (!line) {
        continue;
      }
      segmentPaths.push(
        await getOrCreateTtsSegmentPath({
          text: line,
          voiceId,
        })
      );
      continue;
    }

    if (!isMediaBlock(block) || !block.mediaId) {
      continue;
    }

    if (block.mediaType && block.mediaType !== 'AUDIO') {
      continue;
    }

    const clipStartMs =
      typeof block.clipStartMs === 'number' && Number.isFinite(block.clipStartMs)
        ? block.clipStartMs
        : null;
    const clipEndMs =
      typeof block.clipEndMs === 'number' && Number.isFinite(block.clipEndMs)
        ? block.clipEndMs
        : null;

    try {
      if (clipStartMs != null && clipEndMs != null && clipEndMs > clipStartMs) {
        segmentPaths.push(
          await getOrCreateAudioSegmentPath({
            imageId,
            mediaId: block.mediaId,
            startMs: clipStartMs,
            endMs: clipEndMs,
          })
        );
        continue;
      }

      segmentPaths.push(
        await getOrCreateNormalizedAudioPath({
          imageId,
          mediaId: block.mediaId,
        })
      );
    } catch (segmentError) {
      console.error('Skipping non-playable story cut media block:', segmentError);
    }
  }

  if (segmentPaths.length === 0) {
    throw new Error('Story Cut has no playable audio blocks');
  }

  await concatenateAudioSegmentsToM4a({
    inputPaths: segmentPaths,
    outputPath,
  });

  return outputPath;
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

    // Allow guest access via contributor token
    const guestToken = request.nextUrl.searchParams.get('token');
    if (guestToken) {
      const contributor = await prisma.contributor.findUnique({
        where: { token: guestToken },
        select: { imageId: true },
      });
      if (!contributor || contributor.imageId !== id) {
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

    const image = await prisma.image.findUnique({
      where: { id },
      select: {
        id: true,
        snapshot: {
          select: {
            id: true,
            script: true,
            blocksJson: true,
            emberVoiceId: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!image?.snapshot) {
      return NextResponse.json({ error: 'Story Cut not found' }, { status: 404 });
    }

    const snapshot = image.snapshot;
    const parsedBlocks = JSON.parse(snapshot.blocksJson || '[]');
    const blocks = Array.isArray(parsedBlocks) ? (parsedBlocks as SnapshotBlock[]) : [];
    const sortedBlocks = [...blocks].sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
    const voiceId = snapshot.emberVoiceId || (await resolveNarrationVoice('female')).voiceId;
    const outputPath = await renderSnapshotAudio({
      imageId: id,
      blocks: sortedBlocks,
      voiceId,
      fallbackScript: snapshot.script,
      cachePayload: {
        version: STORY_CUT_AUDIO_RENDER_VERSION,
        imageId: id,
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
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const accessType = await getEmberAccessType(auth.user.id, id);
    if (!accessType) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as
      | {
          script?: string;
          blocks?: SnapshotBlock[];
          voiceId?: string | null;
        }
      | null;

    const script = typeof body?.script === 'string' ? body.script.trim() : '';
    const blocks = Array.isArray(body?.blocks)
      ? [...body.blocks].sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
      : [];
    const voiceId =
      typeof body?.voiceId === 'string' && body.voiceId.trim()
        ? body.voiceId.trim()
        : (await resolveNarrationVoice('female')).voiceId;

    if (!script && blocks.length === 0) {
      return NextResponse.json({ error: 'Story Cut has no playable content' }, { status: 400 });
    }

    const outputPath = await renderSnapshotAudio({
      imageId: id,
      blocks,
      voiceId,
      fallbackScript: script,
      cachePayload: {
        version: STORY_CUT_AUDIO_RENDER_VERSION,
        imageId: id,
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
      },
    });
  } catch (error) {
    console.error('Draft Story Cut audio render error:', error);
    return NextResponse.json({ error: 'Failed to prepare story cut audio' }, { status: 500 });
  }
}
