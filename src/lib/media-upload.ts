import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { getUploadPath, getUploadsDir, inferMediaType } from '@/lib/uploads';
import { generatePosterFrame, probeVideo } from '@/lib/video-processing';

export type PersistedMediaType = 'IMAGE' | 'VIDEO' | 'AUDIO';

function describeVideoProcessingError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('ffmpeg') ||
      message.includes('ffprobe') ||
      message.includes('enoent')
    ) {
      return 'Video uploaded, but poster-frame processing failed because ffmpeg/ffprobe is not available on the server';
    }

    return `Video uploaded, but poster-frame processing failed: ${error.message}`;
  }

  return 'Video uploaded, but poster-frame processing failed';
}

export async function persistUploadedMedia(file: File): Promise<{
  filename: string;
  mediaType: PersistedMediaType;
  posterFilename: string | null;
  durationSeconds: number | null;
  warning: string | null;
}> {
  const mediaType = inferMediaType(file.name, file.type);
  if (!mediaType) {
    throw new Error('Only images, videos, and common audio files are supported');
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext) {
    throw new Error('File extension is required');
  }

  const filename = `${randomUUID()}.${ext}`;
  const filePath = getUploadPath(filename);
  let posterFilename: string | null = null;
  let durationSeconds: number | null = null;
  let warning: string | null = null;

  await mkdir(getUploadsDir(), { recursive: true });

  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));

  try {
    if (mediaType === 'VIDEO') {
      const nextPosterFilename = `${randomUUID()}.jpg`;
      const posterPath = getUploadPath(nextPosterFilename);
      const videoMetadata = await probeVideo(filePath);

      await generatePosterFrame({
        inputPath: filePath,
        outputPath: posterPath,
        durationSeconds: videoMetadata.durationSeconds,
      });

      posterFilename = nextPosterFilename;
      durationSeconds = videoMetadata.durationSeconds;
    }
  } catch (error) {
    if (posterFilename) {
      await unlink(getUploadPath(posterFilename)).catch(() => undefined);
      posterFilename = null;
    }

    durationSeconds = null;
    warning = describeVideoProcessingError(error);
  }

  return {
    filename,
    mediaType,
    posterFilename,
    durationSeconds,
    warning,
  };
}
