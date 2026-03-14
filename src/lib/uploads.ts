import { join } from 'path';

export function getUploadsDir(): string {
  return process.env.UPLOADS_DIR || join(process.cwd(), 'public', 'uploads');
}

export function getUploadPath(filename: string): string {
  return join(getUploadsDir(), filename);
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
