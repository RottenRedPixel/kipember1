'use client';

import { Flame, Pause, Play, ScanEye, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MicLevelMeter from '@/components/kipember/workflows/MicLevelMeter';
import { useResetZoomOnOpen } from '@/lib/reset-zoom';

const SHEET_H = '40vh';
const SNAP_MS = 320;

// Facet definition — what shows in the chip row.
type Facet = {
  key: string;       // claimType key OR person first-name OR 'snapshot'
  label: string;     // display text
  color: string;     // highlight background when selected
  vizColor: string;  // play-button / visualizer colour
  isPerson?: boolean;
  isSnapshot?: boolean;
};

const ORANGE = 'rgba(249,115,22,0.6)';
const BLUE   = 'rgba(96,165,250,0.6)';
const RED    = 'rgba(248,113,113,0.6)';

// Static topic facets — all blue.
const TOPIC_FACETS: Omit<Facet, 'key'>[] & { key: string }[] = [
  { key: 'why',         label: 'why',       color: BLUE, vizColor: '#60a5fa' },
  { key: 'emotion',     label: 'feelings',  color: BLUE, vizColor: '#60a5fa' },
  { key: 'extra_story', label: 'anecdotes', color: BLUE, vizColor: '#60a5fa' },
  { key: 'place',       label: 'place',     color: BLUE, vizColor: '#60a5fa' },
];

const SNAPSHOT_FACET: Facet = {
  key: 'snapshot',
  label: 'snapshot',
  color: ORANGE,
  vizColor: 'var(--color-accent)',
  isSnapshot: true,
};

type PlaybackState = 'idle' | 'composing' | 'loading' | 'playing' | 'paused';

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

export default function StoriesSheet({
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

  // Available facets — built from claim types that have data + tagged people.
  const [availableClaimTypes, setAvailableClaimTypes] = useState<Set<string>>(new Set());
  const [taggedNames, setTaggedNames] = useState<string[]>([]);

  // Which facet keys the user has selected.
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set(['snapshot']));

  // The composed script for the current selection (null = not yet composed).
  const [composedScript, setComposedScript] = useState<string | null>(null);

  const durationSeconds = 7; // fixed short-form story length

  const savedRef = useRef(false); // prevent double-save per play session

  const IDLE_PROMPTS = useMemo(() => [
    'choose your own adventure...',
    'listen to different versions...',
    'remix the memory...',
    'have fun and enjoy these stories...',
  ], []);
  const [idlePromptIdx, setIdlePromptIdx] = useState(() => Math.floor(Math.random() * 4));
  const [idlePromptVisible, setIdlePromptVisible] = useState(true);

  // Build the chip row: topic facets with data → person chips → snapshot at tail.
  const facets: Facet[] = useMemo(() => {
    const result: Facet[] = [];
    for (const tf of TOPIC_FACETS) {
      if (availableClaimTypes.has(tf.key)) result.push(tf);
    }
    for (const name of taggedNames) {
      result.push({
        key: name,
        label: name,
        color: RED,
        vizColor: '#f87171',
        isPerson: true,
      });
    }
    if (storyScript) result.push(SNAPSHOT_FACET);
    return result;
  }, [availableClaimTypes, taggedNames, storyScript]);

  // Play button colour:
  //   snapshot only      → orange
  //   topics only        → blue
  //   names only         → red
  //   topics + names mix → purple
  const vizColor = useMemo(() => {
    if (selectedKeys.has('snapshot')) return SNAPSHOT_FACET.vizColor;
    const hasTopics  = facets.some((f) => !f.isPerson && !f.isSnapshot && selectedKeys.has(f.key));
    const hasPersons = facets.some((f) => f.isPerson && selectedKeys.has(f.key));
    if (hasTopics && hasPersons) return '#a78bfa'; // purple
    if (hasTopics)  return '#60a5fa'; // blue
    if (hasPersons) return '#f87171'; // red
    return SNAPSHOT_FACET.vizColor;  // nothing selected — default orange
  }, [facets, selectedKeys]);

  const activeScript = composedScript;
  const storyLines = useMemo(() => buildStoryLines(activeScript), [activeScript]);
  const shouldAnimate = playbackState === 'playing' && !done;
  const isPlaying = playbackState === 'playing';

  // ── Audio refs ───────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const disposeAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null; }
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
    analyserRef.current = null;
    if (audioCtxRef.current) { void audioCtxRef.current.close().catch(() => undefined); audioCtxRef.current = null; }
  }, []);

  useEffect(() => () => { disposeAudio(); }, [disposeAudio]);

  // ── Story text fade-in ───────────────────────────────────────────────────
  const [storyEntered, setStoryEntered] = useState(false);
  useEffect(() => {
    if (!isPlaying) { setStoryEntered(false); return; }
    const raf = requestAnimationFrame(() => setStoryEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  // ── Idle prompt cycling ──────────────────────────────────────────────────
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!isOpen) { wasOpenRef.current = false; return; }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    setIdlePromptVisible(false);
    const t = setTimeout(() => {
      setIdlePromptIdx((i) => { let n = Math.floor(Math.random() * IDLE_PROMPTS.length); if (n === i) n = (i + 1) % IDLE_PROMPTS.length; return n; });
      setIdlePromptVisible(true);
    }, 600);
    return () => clearTimeout(t);
  }, [isOpen, IDLE_PROMPTS.length]);

  const isPlayingPrevRef = useRef(isPlaying);
  useEffect(() => {
    if (isPlayingPrevRef.current === isPlaying) return;
    isPlayingPrevRef.current = isPlaying;
    setIdlePromptVisible(false);
    const t = setTimeout(() => {
      setIdlePromptIdx((i) => { let n = Math.floor(Math.random() * IDLE_PROMPTS.length); if (n === i) n = (i + 1) % IDLE_PROMPTS.length; return n; });
      setIdlePromptVisible(true);
    }, 600);
    return () => clearTimeout(t);
  }, [isPlaying, IDLE_PROMPTS.length]);

  // ── Line advance animation ───────────────────────────────────────────────
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
      setLineIndex((c) => Math.min(c + 2, Math.max(storyLines.length - 1, 0)));
      setFading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [fading, storyLines.length]);

  // ── Fetch available claim types + tagged names when sheet opens ──────────
  useEffect(() => {
    if (!isOpen || !emberId) return;
    let cancelled = false;

    // Fetch claim types from reconciliation endpoint
    fetch(`/api/embers/${encodeURIComponent(emberId)}/reconciliation`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { claims?: Array<{ claimType: string }> } | null) => {
        if (cancelled || !d?.claims) return;
        setAvailableClaimTypes(new Set(d.claims.map((c) => c.claimType)));
      })
      .catch(() => {});

    // Fetch tagged people names
    fetch(`/api/embers/${encodeURIComponent(emberId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { tags?: Array<{ user?: { firstName?: string | null } | null; emberContributor?: { user?: { firstName?: string | null } | null } | null; label?: string | null }> } ) => {
        if (cancelled) return;
        const tags = Array.isArray(d?.tags) ? d.tags : [];
        const seen = new Set<string>();
        const names: string[] = [];
        for (const t of tags) {
          const first = (t.user?.firstName ?? t.emberContributor?.user?.firstName ?? t.label ?? '')
            .toString().trim().split(/\s+/)[0];
          if (!first) continue;
          const key = first.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          names.push(first);
        }
        setTaggedNames(names);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [isOpen, emberId]);

  // ── Reset on close ───────────────────────────────────────────────────────
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
      setComposedScript(null);
      setSelectedKeys(new Set(['snapshot']));
      setError('');
      savedRef.current = false;
    }
  }, [isOpen, disposeAudio]);

  // ── Chip toggle — resets composition when selection changes ─────────────
  const toggleKey = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // snapshot is mutually exclusive with everything else
        if (key === 'snapshot') {
          for (const k of next) { if (k !== 'snapshot') next.delete(k); }
        } else {
          next.delete('snapshot');
        }
      }
      // Never leave the selection empty — fall back to snapshot.
      if (next.size === 0) next.add('snapshot');
      return next;
    });
    // Changing selection invalidates the current composed script.
    disposeAudio();
    setPlaybackState('idle');
    setComposedScript(null);
    setLineIndex(0);
    setFading(false);
    setDone(false);
    setError('');
    savedRef.current = false;
  }, [disposeAudio]);

  // ── Build audio element from a blob ──────────────────────────────────────
  const buildAudioFromBlob = useCallback(async (blob: Blob) => {
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audio.addEventListener('play', () => setPlaybackState('playing'));
    audio.addEventListener('pause', () => setPlaybackState((c) => c === 'loading' ? c : 'paused'));
    audio.addEventListener('ended', () => { setPlaybackState('paused'); setDone(true); });
    audio.addEventListener('error', () => setPlaybackState('paused'));
    audioRef.current = audio;
    audioUrlRef.current = audioUrl;
    try {
      const AudioCtor =
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
  }, []);

  // ── Save a played story to the DB ────────────────────────────────────────
  const saveStory = useCallback(async (script: string) => {
    if (!emberId || savedRef.current) return;
    savedRef.current = true;
    const facetKeys = Array.from(selectedKeys).filter((k) => k !== 'snapshot' && !taggedNames.includes(k));
    const personKeys = Array.from(selectedKeys).filter((k) => taggedNames.includes(k));
    try {
      await fetch(`/api/embers/${encodeURIComponent(emberId)}/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, facets: facetKeys, people: personKeys, durationSeconds }),
      });
    } catch { /* non-blocking */ }
  }, [emberId, selectedKeys, taggedNames, durationSeconds]);

  // ── Main play handler ─────────────────────────────────────────────────────
  const handleToggle = useCallback(async () => {
    if (playbackState === 'composing' || playbackState === 'loading') return;

    // Pause if already playing
    if (audioRef.current && playbackState === 'playing') {
      audioRef.current.pause();
      return;
    }

    // Resume if paused and audio already built
    if (audioRef.current && playbackState === 'paused') {
      try { await audioRef.current.play(); } catch { /* ignore */ }
      return;
    }

    // ── Need to start fresh ──
    if (!emberId) return;
    setError('');

    const isSnapshotMode = selectedKeys.has('snapshot') && selectedKeys.size === 1;
    const hasNonSnapshot = Array.from(selectedKeys).some((k) => k !== 'snapshot');

    let script = composedScript;

    if (!script) {
      if (isSnapshotMode || (!hasNonSnapshot && storyScript)) {
        // Snapshot shortcut — use the pre-generated script
        if (!storyScript) { setError('No snapshot yet.'); return; }
        script = storyScript;
        setComposedScript(script);
      } else {
        // Compose on demand
        const facetKeys = Array.from(selectedKeys).filter((k) =>
          k !== 'snapshot' && !taggedNames.includes(k)
        );
        const personKeys = Array.from(selectedKeys).filter((k) => taggedNames.includes(k));

        if (facetKeys.length === 0 && personKeys.length === 0) {
          setError('Select at least one facet or person.');
          return;
        }

        setPlaybackState('composing');
        try {
          const tokenQs = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
          const response = await fetch(
            `/api/embers/${encodeURIComponent(emberId)}/stories/compose${tokenQs}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ facets: facetKeys, people: personKeys, durationSeconds }),
            }
          );
          const payload = await response.json().catch(() => null);
          if (!response.ok) throw new Error(payload?.error ?? 'Failed to compose story.');
          script = payload.script as string;
          setComposedScript(script);
        } catch (err) {
          setPlaybackState('idle');
          setError(err instanceof Error ? err.message : 'Failed to compose story.');
          return;
        }
      }
    }

    // Fetch audio for the script
    setPlaybackState('loading');
    try {
      const tokenQs = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
      const response = await fetch(
        `/api/embers/${encodeURIComponent(emberId)}/snapshot-audio${tokenQs}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script }),
        }
      );
      if (!response.ok) {
        const p = await response.json().catch(() => null);
        throw new Error(p?.error ?? 'Audio not available.');
      }
      const blob = await response.blob();
      const audio = await buildAudioFromBlob(blob);
      await audio.play();
      void saveStory(script);
    } catch (err) {
      setPlaybackState('paused');
      setError(err instanceof Error ? err.message : 'Audio could not be played.');
    }
  }, [
    playbackState, emberId, selectedKeys, composedScript,
    storyScript, taggedNames, durationSeconds, accessToken,
    buildAudioFromBlob, saveStory,
  ]);

  function handleClose() {
    setShowing(false);
    setTimeout(onClose, SNAP_MS);
  }

  const statusLabel =
    playbackState === 'composing' ? 'writing story…' :
    playbackState === 'loading'   ? 'preparing audio…' :
    null;

  const hasSelection = selectedKeys.size > 0;

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
      {/* Play / Pause button — floats on the sheet's top edge */}
      {isOpen ? (
        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={playbackState === 'composing' || playbackState === 'loading'}
          className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full cursor-pointer [@media(hover:hover)]:hover:brightness-110 [@media(hover:hover)]:hover:scale-105 transition-[filter,transform,background] duration-150"
          style={{
            top: -24,
            width: 48,
            height: 48,
            background: vizColor,
            border: '6px solid var(--bg-sheets)',
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={18} color="#ffffff" strokeWidth={2} fill="#ffffff" />
          ) : (
            <Play size={18} color="#ffffff" strokeWidth={2} fill="#ffffff" />
          )}
        </button>
      ) : null}

      {/* Status label under play button */}
      {isOpen && statusLabel ? (
        <p
          className="absolute left-0 right-0 text-center pointer-events-none text-xs"
          style={{ top: 30, color: 'rgba(255,255,255,0.45)' }}
        >
          {statusLabel}
        </p>
      ) : null}

      {/* Header */}
      <div className="flex items-center px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-header)' }}>
        <Flame size={18} color="white" strokeWidth={1.6} />
        <span className="flex-1 ml-2 text-white font-semibold text-base">stories</span>
        <button type="button" className="cursor-pointer" onClick={handleClose}>
          <X size={20} color="var(--text-secondary)" strokeWidth={1.8} />
        </button>
      </div>

      {error ? (
        <p className="text-xs text-center px-4 mt-1 flex-shrink-0" style={{ color: 'rgba(255,100,100,0.8)' }}>
          {error}
        </p>
      ) : null}

      {/* Body — story text + visualizer + chips */}
      <div
        className="absolute left-0 right-0 bottom-0 px-4 flex flex-col pointer-events-none [&_button]:pointer-events-auto"
        style={{ top: 56 }}
      >
        {/* Story text / idle prompt */}
        <div className="flex-1 flex flex-col items-center justify-center">
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

          {/* Mic visualizer */}
          <div className="flex justify-center mb-4 w-full" style={{ minHeight: 20 }}>
            {isPlaying ? (
              <MicLevelMeter
                analyser={analyserRef.current}
                color={vizColor}
                bars={22}
                className="w-[70%] h-5"
              />
            ) : null}
          </div>
        </div>

        {/* Facet / person chips */}
        <div className="flex flex-wrap justify-center gap-2 pb-4">
          {facets.map((facet) => {
            const isSelected = selectedKeys.has(facet.key);
            // Snapshot chip gets its own icon
            const showIcon = facet.isSnapshot;
            return (
              <button
                key={facet.key}
                type="button"
                onClick={() => toggleKey(facet.key)}
                className="flex-shrink-0 flex items-center justify-center gap-1.5 rounded-full px-4 text-sm font-normal cursor-pointer [@media(hover:hover)]:hover:brightness-125 [@media(hover:hover)]:hover:scale-105 transition-[filter,transform,background] duration-150"
                style={{
                  height: 26,
                  background: isSelected ? facet.color : 'var(--bg-drill-blocks)',
                  border: '1px solid var(--border-subtle)',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                {showIcon ? <ScanEye size={12} strokeWidth={2} /> : null}
                {facet.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
