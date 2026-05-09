'use client';

import Link from 'next/link';
import { Heart, MapPinned, ScanEye, Smile, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';


type KipemberStoriesOverlayProps = {
  closeHref: string;
  emberId: string | null;
  storyScript: string | null;
  guestToken?: string | null;
};

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused';

function buildStoryLines(value: string | null | undefined) {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text) {
    return [];
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

function resetAudioPosition(audio: HTMLAudioElement) {
  audio.currentTime = 0;
}

export default function KipemberStoriesOverlay({
  closeHref,
  emberId,
  storyScript,
  guestToken,
}: KipemberStoriesOverlayProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const prepareAttemptedRef = useRef(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [error, setError] = useState('');
  const [lineIndex, setLineIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(3);
  const [filledBadge, setFilledBadge] = useState<number | null>(null);

  const storyLines = useMemo(() => buildStoryLines(storyScript), [storyScript]);
  const hasPlayableContent = Boolean(storyScript);
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
    if (!emberId || !storyScript) {
      throw new Error('This ember does not have a snapshot yet.');
    }

    const audioUrl = guestToken
      ? `/api/embers/${emberId}/snapshot-audio?token=${encodeURIComponent(guestToken)}`
      : `/api/embers/${emberId}/snapshot-audio`;
    const response = await fetch(audioUrl, {
      cache: 'no-store',
    });

    if (response.ok) {
      return await response.blob();
    }

    const payload = await response.json().catch(() => null);
    throw new Error(
      typeof payload?.error === 'string' ? payload.error : 'Story audio is not available yet.'
    );
  }, [emberId, storyScript]);

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
      if (!emberId || !hasPlayableContent) {
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
    [buildAudio, emberId, hasPlayableContent]
  );

  useEffect(() => {
    if (prepareAttemptedRef.current || !emberId || !hasPlayableContent) {
      return;
    }

    prepareAttemptedRef.current = true;
    void buildAudio().catch(() => undefined);
  }, [emberId, hasPlayableContent, buildAudio]);

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

  return (
    <>
      <Link href={closeHref} className="fixed inset-0" style={{ zIndex: 29 }} aria-label="Close" />
      <div className="absolute left-0 right-0 z-30 flex flex-col items-center px-4 gap-3" style={{ bottom: 88 }}>
        <div className="w-full max-w-sm text-center px-2" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>
          <p
            className="font-medium leading-snug w-full truncate"
            style={{ fontSize: '1.3rem', color: playbackState === 'playing' && !fading ? '#ffffff' : 'transparent', transition: 'color 0.8s ease' }}
          >
            {storyLines[lineIndex] ?? ' '}
          </p>
          <p
            className="font-medium leading-snug w-full truncate"
            style={{
              fontSize: '1.3rem',
              color: playbackState === 'playing' && !fading && storyLines[lineIndex + 1] ? '#ffffff' : 'transparent',
              transition: 'color 0.8s ease',
            }}
          >
            {storyLines[lineIndex + 1] ? `${storyLines[lineIndex + 1]}...` : ' '}
          </p>
        </div>

        {(() => {
            const BADGES = [
              { icon: MapPinned, active: 'rgba(134,239,172,0.55)', color: '#ffffff', label: 'place & time' },
              { icon: Users,     active: 'rgba(96,165,250,0.55)',  color: '#ffffff', label: 'friends & family' },
              { icon: Heart,     active: 'rgba(244,114,182,0.55)', color: '#ffffff', label: 'feelings & emotions' },
              { icon: Smile,     active: 'rgba(253,224,71,0.55)',  color: '#ffffff', label: 'interesting stories' },
              { icon: ScanEye,   active: 'rgba(249,115,22,0.55)',  color: '#ffffff', label: 'snapshot of this memory' },
            ];
            return (
              <>
              <div
                className="relative w-full rounded-full overflow-hidden"
                style={{ background: 'rgba(0,0,0,0.85)', display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr 50px' }}
              >
                {/* sliding indicator — outer slots are 50px wide so badge 0/4 rings are concentric with pill end caps */}
                <div
                  className="absolute rounded-full transition-all duration-200"
                  style={{
                    width: 42,
                    height: 42,
                    top: 4,
                    left: [
                      '4px',
                      'calc(29px + (100% - 100px) / 6)',
                      'calc(29px + (100% - 100px) / 2)',
                      'calc(29px + 5 * (100% - 100px) / 6)',
                      'calc(100% - 46px)',
                    ][selectedBadge],
                    background: (selectedBadge === 4 ? (playbackState === 'playing' || playbackState === 'loading') : filledBadge === selectedBadge) ? BADGES[selectedBadge].active : 'transparent',
                    border: `3px solid ${BADGES[selectedBadge].active}`,
                  }}
                />
                {BADGES.map(({ icon: Icon, color }, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (i === 4) {
                        if (selectedBadge !== 4) {
                          setSelectedBadge(4);
                          setFilledBadge(null);
                        } else {
                          handleToggle();
                        }
                      } else {
                        if (selectedBadge === 4 && playbackState === 'playing' && audioRef.current) {
                          audioRef.current.pause();
                        }
                        if (i === selectedBadge) {
                          setFilledBadge(filledBadge === i ? null : i);
                        } else {
                          setSelectedBadge(i);
                          setFilledBadge(null);
                        }
                      }
                    }}
                    className="relative flex items-center justify-center py-[16px] cursor-pointer"
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.8}
                      color={selectedBadge === i ? color : 'rgba(255,255,255,0.3)'}
                      style={{ transition: 'color 0.2s ease' }}
                    />
                  </button>
                ))}
              </div>
              <p className="w-full text-center text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {selectedBadge === 4 && playbackState === 'loading' ? 'preparing audio…' : BADGES[selectedBadge].label}
              </p>
              {error ? (
                <p className="w-full text-center text-xs" style={{ color: 'rgba(255,100,100,0.8)' }}>
                  {error}
                </p>
              ) : null}
              </>
            );
          })()}
      </div>
    </>
  );
}
