import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { extractAudioClipToM4a, transcodeAudioToM4a } from '@/lib/audio-processing';
import { prisma } from '@/lib/db';
import { getUploadFallbackUrl, getUploadPath, getUploadsDir, readUploadBuffer } from '@/lib/uploads';

const AUDIO_SEGMENT_VERSION = 'v3'; // v3: +150ms lead / +300ms trail padding on all clips

export type ResolvedAudioSource = {
  source: string;
  fallbackStartMs: number | null;
  fallbackEndMs: number | null;
};

export async function resolveAudioSourceForMedia(
  emberId: string,
  mediaId: string
): Promise<ResolvedAudioSource | null> {
  const [attachment, imageMedia, voiceClip, voiceMessageClip] = await Promise.all([
    prisma.emberAttachment.findFirst({
      where: {
        emberId,
        id: mediaId,
        mediaType: 'AUDIO',
      },
      select: {
        id: true,
        filename: true,
      },
    }),
    prisma.ember
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
    prisma.emberCallClip.findFirst({
      where: { emberId, id: mediaId },
      select: {
        id: true,
        audioUrl: true,
        startMs: true,
        endMs: true,
        voiceCall: { select: { recordingUrl: true } },
      },
    }),
    prisma.emberVoiceClip.findFirst({
      where: { emberId, id: mediaId },
      select: { id: true, audioFilename: true, startMs: true, endMs: true },
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

  if (voiceClip) {
    // Prefer a URL we own (/api/uploads/…) over an external Retell URL which
    // may be expired. Also check the parent VoiceCall.recordingUrl — after
    // pullRetellRecordingToStorage runs it points to our local storage.
    const candidates = [voiceClip.audioUrl, voiceClip.voiceCall?.recordingUrl]
      .filter((u): u is string => Boolean(u));
    const localUrl = candidates.find((u) => u.startsWith('/api/uploads/'));
    const chosen = localUrl ?? candidates[0];
    console.log(`[audio-segments] EmberCallClip ${voiceClip.id}: candidates=${JSON.stringify(candidates)}, chosen=${chosen ?? 'NONE'}`);
    if (!chosen) {
      console.warn('[audio-segments] EmberCallClip has no usable audioUrl', voiceClip.id);
      return null;
    }
    // Translate /api/uploads/<filename> → absolute disk path so ffmpeg gets a
    // real file rather than an HTTP URL. External URLs are passed through as-is.
    let source: string;
    if (chosen.startsWith('/api/uploads/')) {
      const filename = chosen.replace(/^\/api\/uploads\//, '');
      source = getUploadPath(filename);
    } else {
      source = chosen;
    }
    console.log(`[audio-segments] EmberCallClip ${voiceClip.id}: source=${source}`);
    return {
      source,
      fallbackStartMs: voiceClip.startMs ?? null,
      fallbackEndMs: voiceClip.endMs ?? null,
    };
  }

  if (voiceMessageClip?.audioFilename) {
    // Prefer local disk (fast). If the file is missing (e.g. after a Render
    // restart), restore it from R2 via readUploadBuffer — which reads R2
    // directly without going through the HTTP uploads route. Write it back
    // to local disk so ffmpeg always gets a real file path, not a URL.
    const localPath = getUploadPath(voiceMessageClip.audioFilename);
    console.log(`[audio-segments] EmberVoiceClip ${voiceMessageClip.id}: audioFilename=${voiceMessageClip.audioFilename}, localPath=${localPath}`);
    let source = localPath;
    try {
      await fs.access(localPath);
      console.log(`[audio-segments] EmberVoiceClip ${voiceMessageClip.id}: found on disk`);
    } catch {
      console.warn(`[audio-segments] EmberVoiceClip ${voiceMessageClip.id}: not on disk, trying readUploadBuffer…`);
      try {
        const buffer = await readUploadBuffer(voiceMessageClip.audioFilename);
        await fs.mkdir(dirname(localPath), { recursive: true });
        await fs.writeFile(localPath, buffer);
        console.log(`[audio-segments] EmberVoiceClip ${voiceMessageClip.id}: restored from buffer (${buffer.length} bytes)`);
        source = localPath;
      } catch (bufErr) {
        // Last resort: URL fallback (may or may not work for ffmpeg)
        const fallbackUrl = getUploadFallbackUrl(voiceMessageClip.audioFilename);
        console.error(`[audio-segments] EmberVoiceClip ${voiceMessageClip.id}: readUploadBuffer failed (${bufErr instanceof Error ? bufErr.message : bufErr}), fallbackUrl=${fallbackUrl ?? 'NONE'}`);
        if (fallbackUrl) source = fallbackUrl;
      }
    }
    return {
      source,
      fallbackStartMs: voiceMessageClip.startMs,
      fallbackEndMs: voiceMessageClip.endMs,
    };
  }

  console.warn(`[audio-segments] resolveAudioSourceForMedia: no record found for emberId=${emberId} mediaId=${mediaId}`);
  return null;
}

export async function getOrCreateAudioSegmentPath({
  emberId,
  mediaId,
  startMs,
  endMs,
}: {
  emberId: string;
  mediaId: string;
  startMs: number;
  endMs: number;
}) {
  const sourceInfo = await resolveAudioSourceForMedia(emberId, mediaId);
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
  emberId,
  mediaId,
}: {
  emberId: string;
  mediaId: string;
}) {
  const sourceInfo = await resolveAudioSourceForMedia(emberId, mediaId);
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
