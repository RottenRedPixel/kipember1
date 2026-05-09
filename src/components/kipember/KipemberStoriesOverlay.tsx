'use client';

import Link from 'next/link';
import { Heart, MapPinned, ScanEye, Smile, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MicLevelMeter from '@/components/kipember/workflows/MicLevelMeter';

const BADGES = [
  { icon: MapPinned, active: 'rgba(134,239,172,0.55)', vizColor: '#86efac', label: 'place & time (coming soon)' },
  { icon: Users,     active: 'rgba(96,165,250,0.55)',  vizColor: '#60a5fa', label: 'friends & family (coming soon)' },
  { icon: ScanEye,   active: 'rgba(249,115,22,0.55)',  vizColor: '#f97316', label: 'snapshot of this memory' },
  { icon: Smile,     active: 'rgba(253,224,71,0.55)',  vizColor: '#fde047', label: 'interesting stories (coming soon)' },
  { icon: Heart,     active: 'rgba(244,114,182,0.55)', vizColor: '#f472b6', label: 'feelings & emotions (coming soon)' },
];

const FACET_SCRIPTS: (string | null)[] = [
  'Ember will find some interesting bits about the time and place of this memory as told by the contributors.',
  'Friends and family will tell us about who was there and what was going on.',
  null, // badge 2 uses the real storyScript prop
  'We will discover new facts and anecdotes about this memory.',
  'Hearing about how everyone felt in their own voices will be an awesome experience.',
];

type KipemberStoriesOverlayProps = {
  closeHref: string;
  emberId: string | null;
  storyScript: string | null;
  guestToken?: string | null;
};

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused';

function buildStoryLines(value: string | null | undefined) {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text) return [];

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
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
    if (current) chunks.push(current);
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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const prepareAttemptedRef = useRef(false);
  const selectedBadgeRef = useRef(2);

  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [error, setError] = useState('');
  const [lineIndex, setLineIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(2);

  // Keep ref in sync for use inside callbacks
  useEffect(() => { selectedBadgeRef.current = selectedBadge; }, [selectedBadge]);

  const activeScript = selectedBadge === 2 ? storyScript : FACET_SCRIPTS[selectedBadge];
  const hasPlayableContent = Boolean(emberId) && Boolean(activeScript ?? (selectedBadge === 2 ? storyScript : null));
  const storyLines = useMemo(() => buildStoryLines(activeScript), [activeScript]);
  const shouldAnimate = playbackState === 'playing' && !done;
  const isPlaying = playbackState === 'playing';

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
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
  }, []);

  useEffect(() => () => { disposeAudio(); }, [disposeAudio]);

  useEffect(() => {
    if (!shouldAnimate || fading) return;
    const hasNextPair = lineIndex + 2 < storyLines.length;
    const delay = hasNextPair ? 2800 : 2500;
    const timer = setTimeout(() => {
      if (hasNextPair) setFading(true);
      else setDone(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [fading, lineIndex, shouldAnimate, storyLines.length]);

  useEffect(() => {
    if (!fading) return;
    const timer = setTimeout(() => {
      setLineIndex((current) => Math.min(current + 2, Math.max(storyLines.length - 1, 0)));
      setFading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [fading, storyLines.length]);

  const fetchAudioBlob = useCallback(async () => {
    if (!emberId) throw new Error('No ember selected.');
    const badge = selectedBadgeRef.current;
    const facetScript = FACET_SCRIPTS[badge];

    if (facetScript) {
      const response = await fetch(`/api/embers/${emberId}/snapshot-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: facetScript }),
      });
      if (response.ok) return await response.blob();
      const payload = await response.json().catch(() => null);
      throw new Error(typeof payload?.error === 'string' ? payload.error : 'Audio not available.');
    }

    // Badge 2 — real snapshot
    if (!storyScript) throw new Error('This ember does not have a snapshot yet.');
    const audioUrl = guestToken
      ? `/api/embers/${emberId}/snapshot-audio?token=${encodeURIComponent(guestToken)}`
      : `/api/embers/${emberId}/snapshot-audio`;
    const response = await fetch(audioUrl, { cache: 'no-store' });
    if (response.ok) return await response.blob();
    const payload = await response.json().catch(() => null);
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Story audio is not available yet.');
  }, [emberId, storyScript, guestToken]);

  const buildAudio = useCallback(async () => {
    const audioBlob = await fetchAudioBlob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';

    audio.addEventListener('play', () => setPlaybackState('playing'));
    audio.addEventListener('pause', () =>
      setPlaybackState((current) => (current === 'loading' ? current : 'paused'))
    );
    audio.addEventListener('ended', () => { setPlaybackState('paused'); setDone(true); });
    audio.addEventListener('error', () => {
      setPlaybackState('paused');
    });

    audioRef.current = audio;
    audioUrlRef.current = audioUrl;

    try {
      const AudioCtor: typeof AudioContext | undefined =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtor) {
        const ctx = new AudioCtor();
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
      }
    } catch {
      // Web Audio not available — visualizer won't show but playback still works
    }

    return audio;
  }, [fetchAudioBlob]);

  const startPlayback = useCallback(
    async ({ restart = false }: { restart?: boolean } = {}) => {
      if (!emberId || !hasPlayableContent) return;
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
        const message = playError instanceof Error ? playError.message : 'Audio could not be played.';
        setPlaybackState('paused');
        setError(message);
      }
    },
    [buildAudio, emberId, hasPlayableContent]
  );

  // Pre-fetch snapshot audio only (badge 2) — don't auto-fetch facet scripts
  useEffect(() => {
    if (prepareAttemptedRef.current || !emberId || !storyScript) return;
    prepareAttemptedRef.current = true;
    void buildAudio().catch(() => undefined);
  }, [emberId, storyScript, buildAudio]);

  const handleToggle = useCallback(() => {
    if (playbackState === 'loading') return;
    if (audioRef.current && playbackState === 'playing') {
      audioRef.current.pause();
      return;
    }
    void startPlayback();
  }, [playbackState, startPlayback]);

  const switchBadge = useCallback((i: number) => {
    disposeAudio();
    setPlaybackState('idle');
    setLineIndex(0);
    setFading(false);
    setDone(false);
    setError('');
    setSelectedBadge(i);
  }, [disposeAudio]);

  return (
    <>
      <Link href={closeHref} className="fixed inset-0" style={{ zIndex: 29 }} aria-label="Close" />
      <div className="absolute left-0 right-0 z-30 flex flex-col items-center px-4 gap-3" style={{ bottom: 24 }}>

        <div className="w-full max-w-md text-center px-2">
          <p
            className="font-medium leading-snug w-full truncate"
            style={{
              fontSize: '1.43rem',
              color: isPlaying && !fading ? '#ffffff' : 'transparent',
              textShadow: isPlaying ? '0 1px 8px rgba(0,0,0,0.9)' : 'none',
              transition: 'color 0.8s ease',
            }}
          >
            {storyLines[lineIndex] ?? ' '}
          </p>
          <p
            className="font-medium leading-snug w-full truncate"
            style={{
              fontSize: '1.43rem',
              color: isPlaying && !fading && storyLines[lineIndex + 1] ? '#ffffff' : 'transparent',
              textShadow: isPlaying ? '0 1px 8px rgba(0,0,0,0.9)' : 'none',
              transition: 'color 0.8s ease',
            }}
          >
            {storyLines[lineIndex + 1] ? `${storyLines[lineIndex + 1]}...` : ' '}
          </p>
        </div>

        <div
          className="relative w-full rounded-full overflow-hidden"
          style={{ background: 'rgba(0,0,0,0.85)', display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr 50px' }}
        >
          {/* sliding indicator */}
          <div
            className="absolute rounded-full transition-all duration-200"
            style={{
              width: 42,
              height: 42,
              top: 7,
              left: [
                '4px',
                'calc(29px + (100% - 100px) / 6)',
                'calc(29px + (100% - 100px) / 2)',
                'calc(29px + 5 * (100% - 100px) / 6)',
                'calc(100% - 46px)',
              ][selectedBadge],
              background: (playbackState === 'playing' || playbackState === 'loading')
                ? BADGES[selectedBadge].active
                : 'transparent',
              border: `3px solid ${BADGES[selectedBadge].active}`,
            }}
          />
          {BADGES.map(({ icon: Icon }, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (i !== selectedBadge) {
                  switchBadge(i);
                } else {
                  handleToggle();
                }
              }}
              className="relative flex items-center justify-center py-[18px] cursor-pointer"
            >
              <Icon
                size={18}
                strokeWidth={1.8}
                color={selectedBadge === i ? '#ffffff' : 'rgba(255,255,255,0.3)'}
                style={{ transition: 'color 0.2s ease' }}
              />
            </button>
          ))}
        </div>

        {isPlaying ? (
          <MicLevelMeter
            analyser={analyserRef.current}
            color={BADGES[selectedBadge].vizColor}
            bars={22}
            className="w-[70%] mx-auto h-5"
          />
        ) : (
          <p className="w-full text-center text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {playbackState === 'loading' ? 'preparing audio…' : BADGES[selectedBadge].label}
          </p>
        )}

        {error ? (
          <p className="w-full text-center text-xs" style={{ color: 'rgba(255,100,100,0.8)' }}>
            {error}
          </p>
        ) : null}

      </div>
    </>
  );
}
