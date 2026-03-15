export type EmberMediaType = 'IMAGE' | 'VIDEO';

export function getUploadUrl(filename: string): string {
  return `/api/uploads/${filename}`;
}

export function getPreviewMediaUrl({
  mediaType,
  filename,
  posterFilename,
}: {
  mediaType: EmberMediaType;
  filename: string;
  posterFilename?: string | null;
}): string {
  return getUploadUrl(mediaType === 'VIDEO' && posterFilename ? posterFilename : filename);
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const totalSeconds = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
