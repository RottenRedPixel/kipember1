import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { extractAudioClipToM4a, transcodeAudioToM4a } from '@/lib/audio-processing';
import { prisma } from '@/lib/db';
import { getUploadPath, getUploadsDir } from '@/lib/uploads';

const AUDIO_SEGMENT_VERSION = 'v2';

export type ResolvedAudioSource = {
  source: string;
  fallbackStartMs: number | null;
  fallbackEndMs: number | null;
};

export async function resolveAudioSourceForMedia(
  imageId: string,
  mediaId: string
): Promise<ResolvedAudioSource | null> {
  const [attachment, imageMedia, voiceClip] = await Promise.all([
    prisma.imageAttachment.findFirst({
      where: {
        imageId,
        id: mediaId,
        mediaType: 'AUDIO',
      },
      select: {
        id: true,
        filename: true,
      },
    }),
    prisma.image
      .findFirst({
        where: {
          id: mediaId,
          mediaType: 'AUDIO',
        },
        select: {
          id: true,
          filename: true,
        },
      })
      .catch(() => null),
    prisma.voiceCallClip.findFirst({
      where: {
        imageId,
        id: mediaId,
      },
      select: {
        id: true,
        audioUrl: true,
        startMs: true,
        endMs: true,
      },
    }),
  ]);

  if (attachment) {
    return {
      source: getUploadPath(attachment.filename),
      fallbackStartMs: null,
      fallbackEndMs: null,
    };
  }

  if (imageMedia) {
    return {
      source: getUploadPath(imageMedia.filename),
      fallbackStartMs: null,
      fallbackEndMs: null,
    };
  }

  if (voiceClip?.audioUrl) {
    return {
      source: voiceClip.audioUrl,
      fallbackStartMs: voiceClip.startMs ?? null,
      fallbackEndMs: voiceClip.endMs ?? null,
    };
  }

  return null;
}

export async function getOrCreateAudioSegmentPath({
  imageId,
  mediaId,
  startMs,
  endMs,
}: {
  imageId: string;
  mediaId: string;
  startMs: number;
  endMs: number;
}) {
  const sourceInfo = await resolveAudioSourceForMedia(imageId, mediaId);
  if (!sourceInfo) {
    throw new Error('Audio source not found');
  }

  const cacheKey = createHash('sha1')
    .update(`${AUDIO_SEGMENT_VERSION}:${mediaId}:${sourceInfo.source}:${startMs}:${endMs}`)
    .digest('hex');
  const segmentsDir = join(getUploadsDir(), '.segments');
  const outputPath = join(segmentsDir, `${cacheKey}.m4a`);

  await fs.mkdir(segmentsDir, { recursive: true });

  try {
    await fs.access(outputPath);
  } catch {
    await extractAudioClipToM4a({
      input: sourceInfo.source,
      outputPath,
      startMs,
      endMs,
    });
  }

  return outputPath;
}

export async function getOrCreateNormalizedAudioPath({
  imageId,
  mediaId,
}: {
  imageId: string;
  mediaId: string;
}) {
  const sourceInfo = await resolveAudioSourceForMedia(imageId, mediaId);
  if (!sourceInfo) {
    throw new Error('Audio source not found');
  }

  const cacheKey = createHash('sha1')
    .update(`${AUDIO_SEGMENT_VERSION}:${mediaId}:${sourceInfo.source}:full`)
    .digest('hex');
  const normalizedDir = join(getUploadsDir(), '.normalized-audio');
  const outputPath = join(normalizedDir, `${cacheKey}.m4a`);

  await fs.mkdir(normalizedDir, { recursive: true });

  try {
    await fs.access(outputPath);
  } catch {
    await transcodeAudioToM4a({
      inputPath: sourceInfo.source,
      outputPath,
    });
  }

  return outputPath;
}
