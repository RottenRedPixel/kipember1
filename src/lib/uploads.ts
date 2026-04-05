import { join } from 'path';

type MediaType = 'IMAGE' | 'VIDEO' | 'AUDIO';

export function getUploadsDir(): string {
  return process.env.UPLOADS_DIR || join(process.cwd(), 'public', 'uploads');
}

export function getUploadPath(filename: string): string {
  return join(getUploadsDir(), filename);
}

export function getUploadUrl(filename: string): string {
  return `/api/uploads/${filename}`;
}

export function getPreviewUploadUrl({
  mediaType,
  filename,
  posterFilename,
}: {
  mediaType: MediaType;
  filename: string;
  posterFilename?: string | null;
}): string {
  return getUploadUrl(mediaType === 'VIDEO' && posterFilename ? posterFilename : filename);
}

export function inferMediaType(filename: string, mimeType?: string | null): MediaType | null {
  const normalizedMimeType = mimeType?.toLowerCase() || '';
  if (normalizedMimeType.startsWith('image/')) {
    return 'IMAGE';
  }

  if (normalizedMimeType.startsWith('video/')) {
    return 'VIDEO';
  }

  if (normalizedMimeType.startsWith('audio/')) {
    return 'AUDIO';
  }

  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'heic':
    case 'heif':
    case 'avif':
      return 'IMAGE';
    case 'mp4':
    case 'mov':
    case 'webm':
    case 'm4v':
      return 'VIDEO';
    case 'mp3':
    case 'wav':
    case 'm4a':
    case 'aac':
    case 'ogg':
    case 'oga':
    case 'mpga':
    case 'mpeg':
      return 'AUDIO';
    default:
      return null;
  }
}

export function inferImageMimeType(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'avif':
      return 'image/avif';
    default:
      return null;
  }
}

export function inferUploadMimeType(filename: string): string | null {
  const imageMimeType = inferImageMimeType(filename);
  if (imageMimeType) {
    return imageMimeType;
  }

  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'm4v':
      return 'video/x-m4v';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'm4a':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'ogg':
    case 'oga':
      return 'audio/ogg';
    case 'mpga':
    case 'mpeg':
      return 'audio/mpeg';
    default:
      return null;
  }
}
