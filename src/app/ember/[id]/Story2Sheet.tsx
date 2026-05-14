'use client';

import { Flame, Heart, MapPinned, Pause, Play, ScanEye, Smile, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MicLevelMeter from '@/components/kipember/workflows/MicLevelMeter';
import { useResetZoomOnOpen } from '@/lib/reset-zoom';

const SHEET_H = '35vh';
const SNAP_MS = 320;

const BADGES = [
  { icon: MapPinned, active: 'rgba(134,239,172,0.55)', vizColor: '#86efac', label: 'place & time (coming soon)' },
  { icon: Users,     active: 'rgba(96,165,250,0.55)',  vizColor: '#60a5fa', label: 'friends & family (coming soon)' },
  { icon: ScanEye,   active: 'rgba(249,115,22,0.55)',  vizColor: 'var(--color-accent)', label: 'snapshot of this memory' },
  { icon: Smile,     active: 'rgba(253,224,71,0.55)',  vizColor: '#fde047', label: 'interesting stories (coming soon)' },
  { icon: Heart,     active: 'rgba(244,114,182,0.55)', vizColor: '#f472b6', label: 'feelings & emotions (coming soon)' },
];

const FACET_SCRIPTS: (string | null)[] = [
  'Ember will find some interesting bits about the time and place of this memory as told by the contributors.',
  'Friends and family will tell us about who was there and what was going on.',
  null,
  'We will discover new facts and anecdotes about this memory.',
  'Hearing about how everyone felt in their own voices will be an awesome experience.',
];

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused';

function buildStoryLines(value: string | null | undefined) {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  for (const sentence of sentences) {
    const words = sentence.split(' ').filter(Boolean);
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > 40 && current) { chunks.push(current); current = word; }
      else { current = next; }
    }
    if (current) chunks.push(current);
  }
  return chunks.slice(0, 6);
}

export default function Story2Sheet({
  isOpen,
  onClose,
  emberId,
  storyScript,
  accessToken,
}: {
  isOpen: boolean;
  onClose: () => void;
  emberId: string | null;
  storyScript: string | null;
  accessToken?: string;
}) {
  const [showing, setShowing] = useState(isOpen);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  useResetZoomOnOpen(isOpen);
  const [error, setError] = useState('');
  const [lineIndex, setLineIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(2);
  const [badgeColors, setBadgeColors] = useState<Record<string, string>>({});
  const IDLE_PROMPTS = useMemo(() => [
    'choose your own adventure...',
    'listen to different versions...',
    'remix the memory...',
    'have fun and enjoy these stories...',
  ], []);
  const [idlePromptIdx, setIdlePromptIdx] = useState(() => Math.floor(Math.random() * 4));
  const [idlePromptVisible, setIdlePromptVisible] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const prepareAttemptedRef = useRef(false);
  const selectedBadgeRef = useRef(2);

  useEffect(() => { selectedBadgeRef.current = selectedBadge; }, [selectedBadge]);

  const activeScript = selectedBadge === 2 ? storyScript : FACET_SCRIPTS[selectedBadge];
  const hasPlayableContent = Boolean(emberId) && Boolean(activeScript ?? (selectedBadge === 2 ? storyScript : null));
  const storyLines = useMemo(() => buildStoryLines(activeScript), [activeScript]);
  const shouldAnimate = playbackState === 'playing' && !done;
  const isPlaying = playbackState === 'playing';

  const disposeAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null; }
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
    analyserRef.current = null;
    if (audioCtxRef.current) { void audioCtxRef.current.close().catch(() => undefined); audioCtxRef.current = null; }
  }, []);

  useEffect(() => () => { disposeAudio(); }, [disposeAudio]);

  // Story text fade-in: when isPlaying flips true, mount the text at opacity
  // 0 then flip to 1 on the next frame so the transition has a from-state.
  const [storyEntered, setStoryEntered] = useState(false);
  useEffect(() => {
    if (!isPlaying) { setStoryEntered(false); return; }
    const raf = requestAnimationFrame(() => setStoryEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  // Cycle the idle prompt on each play/pause transition — fade out, swap,
  // fade in. No auto-timer.
  const isPlayingPrevRef = useRef(isPlaying);
  useEffect(() => {
    if (isPlayingPrevRef.current === isPlaying) return;
    isPlayingPrevRef.current = isPlaying;
    setIdlePromptVisible(false);
    const t = setTimeout(() => {
      setIdlePromptIdx((i) => {
        let next = Math.floor(Math.random() * IDLE_PROMPTS.length);
        if (next === i) next = (i + 1) % IDLE_PROMPTS.length;
        return next;
      });
      setIdlePromptVisible(true);
    }, 600);
    return () => clearTimeout(t);
  }, [isPlaying, IDLE_PROMPTS.length]);

  useEffect(() => {
    if (isOpen) {
      setShowing(true);
    } else {
      setShowing(false);
      disposeAudio();
      setPlaybackState('idle');
      setLineIndex(0);
      setFading(false);
      setDone(false);
      setSelectedBadge(2);
      prepareAttemptedRef.current = false;
    }
  }, [isOpen, disposeAudio]);

  useEffect(() => {
    if (!shouldAnimate || fading) return;
    const hasNextPair = lineIndex + 2 < storyLines.length;
    const delay = hasNextPair ? 2800 : 2500;
    const timer = setTimeout(() => { if (hasNextPair) setFading(true); else setDone(true); }, delay);
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
    const tokenQs = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
    const badge = selectedBadgeRef.current;
    const facetScript = FACET_SCRIPTS[badge];
    if (facetScript) {
      const response = await fetch(`/api/embers/${emberId}/snapshot-audio${tokenQs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: facetScript }),
      });
      if (response.ok) return await response.blob();
      const payload = await response.json().catch(() => null);
      throw new Error(typeof payload?.error === 'string' ? payload.error : 'Audio not available.');
    }
    if (!storyScript) throw new Error('This ember does not have a snapshot yet.');
    const response = await fetch(`/api/embers/${emberId}/snapshot-audio${tokenQs}`, { cache: 'no-store' });
    if (response.ok) return await response.blob();
    const payload = await response.json().catch(() => null);
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Story audio is not available yet.');
  }, [emberId, storyScript, accessToken]);

  const buildAudio = useCallback(async () => {
    const audioBlob = await fetchAudioBlob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audio.addEventListener('play', () => setPlaybackState('playing'));
    audio.addEventListener('pause', () => setPlaybackState((current) => (current === 'loading' ? current : 'paused')));
    audio.addEventListener('ended', () => { setPlaybackState('paused'); setDone(true); });
    audio.addEventListener('error', () => { setPlaybackState('paused'); });
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
    } catch { /* visualizer unavailable */ }
    return audio;
  }, [fetchAudioBlob]);

  const startPlayback = useCallback(async ({ restart = false }: { restart?: boolean } = {}) => {
    if (!emberId || !hasPlayableContent) return;
    setError('');
    setPlaybackState('loading');
    try {
      const audio = audioRef.current || (await buildAudio());
      if (restart) { audio.currentTime = 0; setLineIndex(0); setFading(false); setDone(false); }
      await audio.play();
    } catch (playError) {
      setPlaybackState('paused');
      setError(playError instanceof Error ? playError.message : 'Audio could not be played.');
    }
  }, [buildAudio, emberId, hasPlayableContent]);

  useEffect(() => {
    if (prepareAttemptedRef.current || !emberId || !storyScript || !isOpen) return;
    prepareAttemptedRef.current = true;
    void buildAudio().catch(() => undefined);
  }, [emberId, storyScript, isOpen, buildAudio]);

  const handleToggle = useCallback(() => {
    if (playbackState === 'loading') return;
    if (audioRef.current && playbackState === 'playing') { audioRef.current.pause(); return; }
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

  function handleClose() {
    setShowing(false);
    setTimeout(onClose, SNAP_MS);
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-10 flex flex-col"
      style={{
        height: SHEET_H,
        background: 'var(--bg-sheets)',
        borderTop: '1px solid var(--border-subtle)',
        borderRadius: '20px 20px 0 0',
        transform: showing ? 'translateY(0)' : 'translateY(100%)',
        transition: `transform ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      {/* Play button — floats on the header divider line, centered.
          Color tracks the selected topic; click toggles playback. */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={!hasPlayableContent || playbackState === 'loading'}
        className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full cursor-pointer [@media(hover:hover)]:hover:brightness-110 [@media(hover:hover)]:hover:scale-105 transition-[filter,transform,background] duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          top: 31,
          width: 44,
          height: 44,
          background: BADGES[selectedBadge].vizColor,
        }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause size={18} color="#ffffff" strokeWidth={2} fill="#ffffff" />
        ) : (
          <Play size={18} color="#ffffff" strokeWidth={2} fill="#ffffff" />
        )}
      </button>

      {/* Header */}
      <div className="flex items-center px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-header)' }}>
        <Flame size={18} color="white" strokeWidth={1.6} />
        <span className="flex-1 ml-2 text-white font-semibold text-base">story2</span>
        <button type="button" className="cursor-pointer" onClick={handleClose}>
          <X size={20} color="var(--text-secondary)" strokeWidth={1.8} />
        </button>
      </div>

      {error ? (
        <p className="text-xs text-center px-4 mt-1 flex-shrink-0" style={{ color: 'rgba(255,100,100,0.8)' }}>
          {error}
        </p>
      ) : null}

      {/* All content anchored to bottom: story text → visualizer → capsule → label.
          Container is pointer-events-none so empty space doesn't intercept clicks
          on badges/topics above; interactive children re-enable pointer-events. */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pointer-events-none [&_button]:pointer-events-auto [&_a]:pointer-events-auto">

        {/* Story text — or idle prompt when nothing is playing */}
        <div className="text-center mb-5 pointer-events-none">
          {isPlaying ? (
            <div style={{ opacity: storyEntered ? 1 : 0, transition: 'opacity 0.8s ease' }}>
              <p
                className="font-medium leading-snug w-full truncate"
                style={{ fontSize: '1.2rem', color: !fading ? '#ffffff' : 'transparent', transition: 'color 0.8s ease' }}
              >
                {storyLines[lineIndex] ?? ' '}
              </p>
              <p
                className="font-medium leading-snug w-full truncate"
                style={{ fontSize: '1.2rem', color: !fading && storyLines[lineIndex + 1] ? '#ffffff' : 'transparent', transition: 'color 0.8s ease' }}
              >
                {storyLines[lineIndex + 1] ? `${storyLines[lineIndex + 1]}...` : ' '}
              </p>
            </div>
          ) : (
            <p
              className="font-medium leading-snug w-full"
              style={{
                fontSize: '1.2rem',
                color: 'rgba(255,255,255,0.6)',
                opacity: idlePromptVisible ? 1 : 0,
                transition: 'opacity 0.6s ease',
              }}
            >
              {IDLE_PROMPTS[idlePromptIdx]}
            </p>
          )}
        </div>

        {/* Mic visualizer — above capsules, only shown when playing */}
        <div className="flex justify-center mb-4" style={{ minHeight: 20 }}>
          {isPlaying ? (
            <MicLevelMeter
              analyser={analyserRef.current}
              color={BADGES[selectedBadge].vizColor}
              bars={22}
              className="w-[70%] h-5"
            />
          ) : null}
        </div>

        {/* All capsules — one continuous wrapping list. Topic capsules carry
            their own slider color; name capsules use the lighter grey selection. */}
        <div className="flex flex-wrap gap-2 pb-4">
          {[
            'Luca', 'Zia', 'Amado', 'Bob', 'Maya', 'Theo', 'Owen', 'Ivy',
            'place & time', 'friends & family', 'interesting stories', 'feelings & emotions', 'snapshot',
          ].map((name) => {
            const topicToBadge: Record<string, number> = {
              'place & time':         0,
              'friends & family':     1,
              'snapshot':             2,
              'interesting stories':  3,
              'feelings & emotions':  4,
            };
            const badgeIdx = topicToBadge[name];
            const isTopic = badgeIdx !== undefined;
            const isSelected = isTopic
              ? selectedBadge === badgeIdx
              : Boolean(badgeColors[name]);
            const bg = isTopic
              ? (isSelected ? BADGES[badgeIdx].active : 'var(--bg-drill-blocks)')
              : (badgeColors[name] ?? 'var(--bg-drill-blocks)');
            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  if (isTopic) {
                    switchBadge(badgeIdx);
                  } else {
                    setBadgeColors((prev) => {
                      const next = { ...prev };
                      if (next[name]) delete next[name];
                      else next[name] = 'rgba(255,255,255,0.32)';
                      return next;
                    });
                  }
                }}
                className="flex-shrink-0 flex items-center justify-center rounded-full px-4 text-sm font-normal cursor-pointer [@media(hover:hover)]:hover:brightness-125 [@media(hover:hover)]:hover:scale-105 transition-[filter,transform] duration-150"
                style={{
                  height: 26,
                  background: bg,
                  border: '1px solid var(--border-subtle)',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                {name}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
