'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const PLAY_BAR_HEIGHTS = [6, 8, 14, 20, 25, 31, 25, 36, 31, 25, 36, 42, 36, 31, 42, 36, 31, 25, 36, 31, 25, 20, 25, 20, 14, 8, 14, 8, 6, 3].map((height) =>
  Math.round(height * 0.7)
);
const PLAY_BAR_DURATIONS = PLAY_BAR_HEIGHTS.map((_, index) =>
  parseFloat((0.5 + ((index * 7 + 13) % 10) / 20).toFixed(2))
);

type KipemberPlayOverlayProps = {
  closeHref: string;
  addHref: string;
  imageId: string | null;
  storyScript: string | null;
  wikiContent: string | null;
};

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused';

function buildStoryLines(value: string | null | undefined) {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text) {
    return ['Playback will follow this ember', 'as it grows.'];
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const chunks: string[] = [];

  for (const sentence of sentences) {
    const words = sentence.split(' ').filter(Boolean);
    let current = '';

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > 30 && current) {
        chunks.push(current);
        current = word;
      } else {
        current = next;
      }
    }

    if (current) {
      chunks.push(current);
    }
  }

  return chunks.slice(0, 6);
}

function PlaybackControl({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="svg-item"
      style={{ cursor: 'pointer' }}
    >
      <div className="flex flex-col items-center gap-1.5">
        <svg
          width={34}
          height={34}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {children}
        </svg>
        <span className="text-xs text-center leading-tight">{label}</span>
      </div>
    </button>
  );
}

function resetAudioPosition(audio: HTMLAudioElement) {
  audio.currentTime = 0;
}

export default function KipemberPlayOverlay({
  closeHref,
  addHref,
  imageId,
  storyScript,
  wikiContent,
}: KipemberPlayOverlayProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const autoplayAttemptedRef = useRef(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [error, setError] = useState('');
  const [lineIndex, setLineIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(false);

  const transcriptSource = storyScript || wikiContent;
  const storyLines = useMemo(() => buildStoryLines(transcriptSource), [transcriptSource]);
  const canGenerateFallbackNarration = Boolean(storyScript || wikiContent);
  const shouldAnimate = playbackState === 'playing' && !done;

  const disposeAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      disposeAudio();
    };
  }, [disposeAudio]);

  useEffect(() => {
    if (!shouldAnimate || fading) {
      return;
    }

    const hasNextPair = lineIndex + 2 < storyLines.length;
    const delay = hasNextPair ? 2800 : 2500;
    const timer = setTimeout(() => {
      if (hasNextPair) {
        setFading(true);
      } else {
        setDone(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [fading, lineIndex, shouldAnimate, storyLines.length]);

  useEffect(() => {
    if (!fading) {
      return;
    }

    const timer = setTimeout(() => {
      setLineIndex((current) => Math.min(current + 2, Math.max(storyLines.length - 1, 0)));
      setFading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [fading, storyLines.length]);

  const fetchAudioBlob = useCallback(async () => {
    let storyCutError = '';

    if (imageId && storyScript) {
      const response = await fetch(`/api/images/${imageId}/story-cut-audio`, {
        cache: 'no-store',
      });

      if (response.ok) {
        return await response.blob();
      }

      const payload = await response.json().catch(() => null);
      storyCutError =
        typeof payload?.error === 'string' ? payload.error : 'Story audio is not available yet.';
    }

    if (!canGenerateFallbackNarration) {
      throw new Error(storyCutError || 'This ember does not have playable audio yet.');
    }

    const narrationResponse = await fetch('/api/narration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: wikiContent || storyScript || '',
        script: storyScript || undefined,
      }),
    });

    if (!narrationResponse.ok) {
      const payload = await narrationResponse.json().catch(() => null);
      throw new Error(
        typeof payload?.error === 'string'
          ? payload.error
          : storyCutError || 'Audio is not available yet.'
      );
    }

    return await narrationResponse.blob();
  }, [canGenerateFallbackNarration, imageId, storyScript, wikiContent]);

  const buildAudio = useCallback(async () => {
    const audioBlob = await fetchAudioBlob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';

    audio.addEventListener('play', () => {
      setPlaybackState('playing');
    });
    audio.addEventListener('pause', () => {
      setPlaybackState((current) => (current === 'loading' ? current : 'paused'));
    });
    audio.addEventListener('ended', () => {
      setPlaybackState('paused');
      setDone(true);
    });
    audio.addEventListener('error', () => {
      setPlaybackState('paused');
      setError('Audio could not be played on this device.');
    });

    audioRef.current = audio;
    audioUrlRef.current = audioUrl;

    return audio;
  }, [fetchAudioBlob]);

  const startPlayback = useCallback(
    async ({ restart = false, allowAutoplay = false }: { restart?: boolean; allowAutoplay?: boolean } = {}) => {
      if (!imageId) {
        return;
      }

      setError('');
      setPlaybackState('loading');

      try {
        const audio = audioRef.current || (await buildAudio());

        if (restart) {
          resetAudioPosition(audio);
          setLineIndex(0);
          setFading(false);
          setDone(false);
        }

        await audio.play();
      } catch (playError) {
        const message =
          playError instanceof Error ? playError.message : 'Audio could not be played.';
        const suppressedAutoplayError =
          allowAutoplay &&
          (message.includes('NotAllowedError') ||
            message.includes('play() failed') ||
            message.includes('interact with the document first'));

        setPlaybackState('paused');
        if (!suppressedAutoplayError) {
          setError(message);
        }
      }
    },
    [buildAudio, imageId]
  );

  useEffect(() => {
    if (autoplayAttemptedRef.current || !imageId) {
      return;
    }

    const timer = window.setTimeout(() => {
      autoplayAttemptedRef.current = true;
      void startPlayback({ allowAutoplay: true });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [imageId, startPlayback]);

  const handleToggle = useCallback(() => {
    const audio = audioRef.current;
    if (playbackState === 'loading') {
      return;
    }

    if (audio && playbackState === 'playing') {
      audio.pause();
      return;
    }

    void startPlayback();
  }, [playbackState, startPlayback]);

  const handleRestart = useCallback(() => {
    setLineIndex(0);
    setFading(false);
    setDone(false);

    if (audioRef.current) {
      resetAudioPosition(audioRef.current);
      void audioRef.current.play().catch(() => {
        setPlaybackState('paused');
        setError('Audio could not be restarted.');
      });
      return;
    }

    void startPlayback({ restart: true });
  }, [startPlayback]);

  return (
    <>
      <style>{'@keyframes vizPulse { from { transform: scaleY(0.15); } to { transform: scaleY(1); } }'}</style>
      <div className="absolute left-0 right-0 z-30 flex justify-center" style={{ bottom: 88 }}>
        <div
          className="relative flex flex-col items-center px-6 pt-8 pb-6 rounded-2xl"
          style={{
            width: 320,
            background: 'var(--bg-modal)',
            WebkitBackdropFilter: 'blur(5px)',
            backdropFilter: 'blur(5px)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Link
            href={closeHref}
            className="absolute top-3 right-3 text-white/60 w-8 h-8 flex items-center justify-center"
          >
            <X size={18} />
          </Link>

          <div className="flex items-center gap-[3px]" style={{ height: 34 }}>
            {PLAY_BAR_HEIGHTS.map((height, index) => (
              <div
                key={index}
                style={{
                  width: 3,
                  height,
                  borderRadius: 3,
                  background: '#f97316',
                  transformOrigin: 'center',
                  animation: `vizPulse ${PLAY_BAR_DURATIONS[index]}s ease-in-out infinite alternate`,
                  animationDelay: `${(index * 0.04).toFixed(2)}s`,
                  animationPlayState: shouldAnimate ? 'running' : 'paused',
                }}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-1 mt-4 text-center w-full" style={{ height: '3.25em' }}>
            <p
              className="font-medium text-base leading-snug w-full truncate"
              style={{ color: fading ? 'transparent' : '#ffffff', transition: 'color 0.8s ease' }}
            >
              {storyLines[lineIndex] ?? '\u00A0'}
            </p>
            <p
              className="font-medium text-base leading-snug w-full truncate"
              style={{
                color: !fading && storyLines[lineIndex + 1] ? '#ffffff' : 'transparent',
                transition: 'color 0.8s ease',
              }}
            >
              {storyLines[lineIndex + 1] ?? '\u00A0'}
            </p>
          </div>

          {error ? (
            <p className="mt-4 text-center text-xs leading-relaxed text-red-200">{error}</p>
          ) : playbackState === 'loading' ? (
            <p className="mt-4 text-center text-xs leading-relaxed text-white/70">Preparing audio...</p>
          ) : null}

          <div className="w-full mt-5" style={{ borderTop: '1px solid var(--border-default)' }} />

          <div className="flex justify-center gap-8 mt-5">
            <PlaybackControl label="back" onClick={handleRestart}>
              <circle cx="12" cy="12" r="10" />
              <polyline
                points="13,8 9,12 13,16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </PlaybackControl>
            <PlaybackControl
              label={playbackState === 'playing' ? 'pause' : playbackState === 'loading' ? 'wait' : 'play'}
              onClick={handleToggle}
            >
              <circle cx="12" cy="12" r="10" />
              {playbackState === 'playing' ? (
                <>
                  <line x1="10" y1="15" x2="10" y2="9" />
                  <line x1="14" y1="15" x2="14" y2="9" />
                </>
              ) : playbackState === 'loading' ? (
                <path d="M12 8v4l2.5 1.5" />
              ) : (
                <polygon points="10,8 17,12 10,16" fill="currentColor" stroke="none" />
              )}
            </PlaybackControl>
            <Link href={addHref} className="svg-item">
              <div className="flex flex-col items-center gap-1.5">
                <svg
                  width={34}
                  height={34}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                <span className="text-xs text-center leading-tight">add</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
