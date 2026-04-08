'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ClipAudioPlayerProps = {
  src: string;
  startMs?: number | null;
  endMs?: number | null;
  className?: string;
};

function formatTime(valueMs?: number | null) {
  if (valueMs == null || Number.isNaN(valueMs)) {
    return '';
  }

  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function ClipAudioPlayer({
  src,
  startMs,
  endMs,
  className = '',
}: ClipAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const clipStartSeconds =
    typeof startMs === 'number' && Number.isFinite(startMs) ? Math.max(0, startMs / 1000) : 0;
  const clipEndSeconds =
    typeof endMs === 'number' && Number.isFinite(endMs) ? Math.max(0, endMs / 1000) : null;
  const clipRangeLabel = useMemo(() => {
    const start = formatTime(startMs);
    const end = formatTime(endMs);

    if (start && end) {
      return `${start} - ${end}`;
    }

    return start || end || 'Audio clip';
  }, [endMs, startMs]);

  useEffect(() => {
    const audio = new Audio(src);
    audio.preload = 'none';
    audioRef.current = audio;

    const resetToClipStart = () => {
      try {
        if (Number.isFinite(audio.duration)) {
          audio.currentTime = Math.min(clipStartSeconds, audio.duration || clipStartSeconds);
        } else {
          audio.currentTime = clipStartSeconds;
        }
      } catch {
        audio.currentTime = clipStartSeconds;
      }
      setProgress(0);
    };

    const updateProgress = () => {
      const clipEnd = clipEndSeconds ?? audio.duration ?? clipStartSeconds;
      const clipLength = Math.max(0.01, clipEnd - clipStartSeconds);
      const nextProgress = Math.min(
        100,
        Math.max(0, ((audio.currentTime - clipStartSeconds) / clipLength) * 100)
      );
      setProgress(nextProgress);

      if (clipEndSeconds != null && audio.currentTime >= clipEndSeconds) {
        audio.pause();
        resetToClipStart();
        setIsPlaying(false);
      }
    };

    const handleLoadedMetadata = () => {
      resetToClipStart();
    };

    const handleEnded = () => {
      resetToClipStart();
      setIsPlaying(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleError = () => {
      setError('Audio clip could not be played.');
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audioRef.current = null;
    };
  }, [clipEndSeconds, clipStartSeconds, src]);

  const handleToggle = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    setError('');

    if (isPlaying) {
      audio.pause();
      return;
    }

    try {
      if (audio.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          const handleLoaded = () => {
            audio.removeEventListener('loadedmetadata', handleLoaded);
            audio.removeEventListener('error', handleError);
            resolve();
          };
          const handleError = () => {
            audio.removeEventListener('loadedmetadata', handleLoaded);
            audio.removeEventListener('error', handleError);
            reject(new Error('Audio clip could not be played.'));
          };

          audio.addEventListener('loadedmetadata', handleLoaded);
          audio.addEventListener('error', handleError);
          audio.load();
        });
      }

      if (
        audio.currentTime < clipStartSeconds ||
        (clipEndSeconds != null && audio.currentTime >= clipEndSeconds)
      ) {
        const maxStart =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? Math.min(clipStartSeconds, audio.duration)
            : clipStartSeconds;
        audio.currentTime = maxStart;
      }

      await audio.play();
      setIsPlaying(true);
    } catch {
      setError('Audio clip could not be played.');
      setIsPlaying(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleToggle()}
          className="rounded-full bg-[var(--ember-orange)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white"
        >
          {isPlaying ? 'Pause Clip' : 'Play Clip'}
        </button>
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--ember-muted)]">
          {clipRangeLabel}
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/8">
        <div
          className="h-full rounded-full bg-[var(--ember-orange)] transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {error && <div className="mt-2 text-xs text-rose-600">{error}</div>}
    </div>
  );
}
