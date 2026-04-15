import {
  getPreviewMediaUrl,
  getUploadUrl,
  resolvePreviewMediaType,
  type EmberMediaType,
} from '@/lib/media';

type MediaPreviewProps = {
  mediaType: EmberMediaType;
  filename: string;
  posterFilename?: string | null;
  originalName: string;
  className?: string;
  usePosterForVideo?: boolean;
  controls?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  autoPlay?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
};

function AudioPreviewPlaceholder({
  className,
  originalName,
}: {
  className?: string;
  originalName: string;
}) {
  return (
    <div
      role="img"
      aria-label={originalName}
      className={className}
      style={{
        background:
          'radial-gradient(circle at top left, rgba(249,115,22,0.28), transparent 42%), linear-gradient(180deg, #171412 0%, #211a17 100%)',
      }}
    >
      <div className="flex h-full w-full items-center justify-center">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2.5" y="2.5" width="19" height="19" rx="9.5" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" />
          <path
            d="M14 6.75v6.6a2.75 2.75 0 1 1-1.4-2.4V8.05l5.1-1.15v4.95a2.75 2.75 0 1 1-1.4-2.4V5.8L14 6.75Z"
            fill="#f97316"
          />
        </svg>
      </div>
    </div>
  );
}

export default function MediaPreview({
  mediaType,
  filename,
  posterFilename,
  originalName,
  className,
  controls = false,
  muted = false,
  loop = false,
  playsInline = false,
  autoPlay = false,
  preload = 'metadata',
}: MediaPreviewProps) {
  const resolvedMediaType = resolvePreviewMediaType(
    mediaType,
    filename,
    posterFilename
  );

  if (resolvedMediaType === 'VIDEO') {
    return (
      <video
        src={getUploadUrl(filename)}
        poster={posterFilename ? getUploadUrl(posterFilename) : undefined}
        controls={controls}
        muted={controls ? muted : true}
        loop={loop}
        playsInline={playsInline || !controls}
        autoPlay={autoPlay}
        preload={preload}
        className={className}
      />
    );
  }

  if (resolvedMediaType === 'AUDIO') {
    if (controls) {
      return (
        <audio
          src={getUploadUrl(filename)}
          controls
          preload={preload}
          className={className}
        />
      );
    }

    return <AudioPreviewPlaceholder className={className} originalName={originalName} />;
  }

  return (
    <img
      src={getPreviewMediaUrl({ mediaType, filename, posterFilename })}
      alt={originalName}
      className={className}
    />
  );
}
