export type EmberMediaType = 'IMAGE' | 'VIDEO' | 'AUDIO';

const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'mpga',
  'mpeg',
]);

function getExtension(value: string | null | undefined) {
  return value?.split('.').pop()?.toLowerCase() || '';
}

export function isAudioLikeFilename(value: string | null | undefined) {
  return AUDIO_EXTENSIONS.has(getExtension(value));
}

export function resolvePreviewMediaType(
  mediaType: EmberMediaType,
  filename: string,
  posterFilename?: string | null
): EmberMediaType {
  if (
    mediaType === 'AUDIO' ||
    isAudioLikeFilename(filename) ||
    isAudioLikeFilename(posterFilename)
  ) {
    return 'AUDIO';
  }

  return mediaType;
}

export function getUploadUrl(filename: string): string {
  return `/api/uploads/${filename}`;
}

function buildVideoPlaceholderDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#0f172a"/>
    <rect x="24" y="24" width="432" height="272" rx="28" fill="#1e293b"/>
    <circle cx="240" cy="160" r="56" fill="#0ea5e9" opacity="0.9"/>
    <polygon points="226,132 226,188 274,160" fill="#ffffff"/>
    <text x="240" y="255" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#e2e8f0">Video Ember</text>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildAudioPlaceholderDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
    <defs>
      <radialGradient id="audioGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(110 72) rotate(46) scale(182 182)">
        <stop stop-color="rgba(249,115,22,0.34)"/>
        <stop offset="1" stop-color="rgba(249,115,22,0)"/>
      </radialGradient>
      <linearGradient id="audioBg" x1="240" y1="24" x2="240" y2="296" gradientUnits="userSpaceOnUse">
        <stop stop-color="#171412"/>
        <stop offset="1" stop-color="#211A17"/>
      </linearGradient>
    </defs>
    <rect width="480" height="320" rx="28" fill="url(#audioBg)"/>
    <rect width="480" height="320" rx="28" fill="url(#audioGlow)"/>
    <rect x="140" y="60" width="200" height="200" rx="100" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" stroke-width="3"/>
    <path d="M240 116v66c0 16-10.8 27-27 27s-27-11-27-27 10.8-27 27-27c7 0 13.4 1.8 18.2 5v-35.2l58.8-13.2v57c0 16-10.8 27-27 27s-27-11-27-27 10.8-27 27-27c7 0 13.4 1.8 18.2 5V107l-40.2 9z" fill="#f97316"/>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
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
  const resolvedMediaType = resolvePreviewMediaType(mediaType, filename, posterFilename);

  if (resolvedMediaType === 'VIDEO') {
    return posterFilename ? getUploadUrl(posterFilename) : buildVideoPlaceholderDataUrl();
  }

  if (resolvedMediaType === 'AUDIO') {
    return buildAudioPlaceholderDataUrl();
  }

  return getUploadUrl(filename);
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
