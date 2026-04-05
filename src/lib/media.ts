export type EmberMediaType = 'IMAGE' | 'VIDEO' | 'AUDIO';

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
    <rect width="480" height="320" fill="#fff7f2"/>
    <rect x="24" y="24" width="432" height="272" rx="28" fill="#fff"/>
    <circle cx="132" cy="160" r="54" fill="#ff6621" opacity="0.14"/>
    <path d="M136 106v74c0 12-8 20-20 20s-20-8-20-20 8-20 20-20c5 0 10 1 14 4v-42l94-18v58c0 12-8 20-20 20s-20-8-20-20 8-20 20-20c5 0 10 1 14 4v-54l-82 16z" fill="#ff6621"/>
    <text x="240" y="248" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#6b7280">Audio Ember</text>
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
  if (mediaType === 'VIDEO') {
    return posterFilename ? getUploadUrl(posterFilename) : buildVideoPlaceholderDataUrl();
  }

  if (mediaType === 'AUDIO') {
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
