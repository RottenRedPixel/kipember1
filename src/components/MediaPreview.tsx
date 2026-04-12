import { getPreviewMediaUrl, getUploadUrl, type EmberMediaType } from '@/lib/media';

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
  if (mediaType === 'VIDEO') {
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

  if (mediaType === 'AUDIO') {
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

    return (
      <img
        src={getPreviewMediaUrl({ mediaType, filename, posterFilename })}
        alt={originalName}
        className={className}
      />
    );
  }

  return (
    <img
      src={getPreviewMediaUrl({ mediaType, filename, posterFilename })}
      alt={originalName}
      className={className}
    />
  );
}
