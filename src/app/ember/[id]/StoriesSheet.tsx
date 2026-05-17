'use client';

import { Flame, Mic, Pause, Phone, Play, ScanEye, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MicLevelMeter from '@/components/kipember/workflows/MicLevelMeter';
import { useResetZoomOnOpen } from '@/lib/reset-zoom';

// ─── Constants ───────────────────────────────────────────────────────────────

const SHEET_H = '40vh';
const SNAP_MS = 320;

const ORANGE = 'rgba(249,115,22,0.6)';
const BLUE   = 'rgba(96,165,250,0.6)';
const RED    = 'rgba(248,113,113,0.6)';
const PURPLE = 'rgba(167,139,250,0.6)';

const TOPIC_FACETS = [
  { key: 'why',         label: 'why',       color: BLUE, vizColor: '#60a5fa' },
  { key: 'emotion',     label: 'feelings',  color: BLUE, vizColor: '#60a5fa' },
  { key: 'extra_story', label: 'anecdotes', color: BLUE, vizColor: '#60a5fa' },
  { key: 'place',       label: 'place',     color: BLUE, vizColor: '#60a5fa' },
] as const;

const SNAPSHOT_FACET = { key: 'snapshot', label: 'snapshot', color: ORANGE, vizColor: 'var(--color-accent)', isSnapshot: true };

const IDLE_PROMPTS = [
  'choose your own adventure...',
  'listen to different versions...',
  'remix the memory...',
  'have fun and enjoy these stories...',
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = 'idle' | 'loading' | 'playing' | 'paused';

type Facet = {
  key: string; label: string; color: string; vizColor: string;
  isPerson?: boolean; isSnapshot?: boolean;
};

type Block = {
  type: string;
  content?: string; speaker?: string; quote?: string;
  mediaId?: string; mediaType?: string;
  order?: number; durationMs?: number;
  clipStartMs?: number; clipEndMs?: number;
  clipKind?: 'voice' | 'call';
};

type DebugEntry = { ts: string; color: string; text: string };

// ─── Component ───────────────────────────────────────────────────────────────

export default function StoriesSheet({
  isOpen, onClose, emberId, storyScript, accessToken,
}: {
  isOpen: boolean; onClose: () => void;
  emberId: string | null; storyScript: string | null; accessToken?: string;
}) {
  useResetZoomOnOpen(isOpen);

  // ── Slide-in ──
  const [showing, setShowing] = useState(isOpen);

  // ── Playback ──
  const [status, setStatus]   = useState<Status>('idle');
  const [segIdx, setSegIdx]   = useState(0);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  // ── Composition cache (cleared when chips change) ──
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [script, setScript] = useState<string | null>(null);

  // ── Chip / facet data ──
  const [availableClaimTypes, setAvailableClaimTypes] = useState<Set<string>>(new Set());
  const [taggedNames,         setTaggedNames]         = useState<string[]>([]);
  const [hasConfirmedLocation, setHasConfirmedLocation] = useState(false);
  const [voiceClipSpeakers,   setVoiceClipSpeakers]   = useState<string[]>([]);
  const [callClipSpeakers,    setCallClipSpeakers]     = useState<string[]>([]);
  const [selectedKeys,        setSelectedKeys]         = useState<Set<string>>(new Set(['snapshot']));

  // ── Debug log ──
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([]);

  // ── Idle prompt ──
  const [idlePromptIdx,     setIdlePromptIdx]     = useState(() => Math.floor(Math.random() * IDLE_PROMPTS.length));
  const [idlePromptVisible, setIdlePromptVisible] = useState(true);

  // ── Playback refs (mutated directly, not in React state) ──
  const genRef         = useRef(0);                          // cancel token for active session
  const audiosRef      = useRef<(HTMLAudioElement | null)[]>([]); // one per block (null = pause/skip)
  const urlsRef        = useRef<string[]>([]);               // blob URLs to revoke
  const blocksRef      = useRef<Block[]>([]);                // blocks for the active session
  const currentAudio   = useRef<HTMLAudioElement | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const savedRef       = useRef(false);

  const durationSeconds = 7;

  // ─── Debug helper ────────────────────────────────────────────────────────

  const dbg = useCallback((text: string, color = 'rgba(255,255,255,0.6)') => {
    const ts = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDebugLog((prev) => [...prev.slice(-40), { ts, color, text }]);
  }, []);

  // ─── Dispose — kills the active session and frees all resources ──────────

  const dispose = useCallback(() => {
    genRef.current += 1; // invalidates all in-flight playFrom callbacks
    if (currentAudio.current) { currentAudio.current.pause(); currentAudio.current = null; }
    for (const a of audiosRef.current) { if (a) { try { a.pause(); a.src = ''; } catch { /* ignore */ } } }
    for (const u of urlsRef.current) URL.revokeObjectURL(u);
    audiosRef.current = [];
    urlsRef.current = [];
    blocksRef.current = [];
    if (audioCtxRef.current) { void audioCtxRef.current.close().catch(() => undefined); audioCtxRef.current = null; }
    analyserRef.current = null;
  }, []);

  useEffect(() => () => { dispose(); }, [dispose]);

  // ─── Sequential playback engine ──────────────────────────────────────────
  // playFrom is called with the generation token captured at session start.
  // If genRef has advanced past that token, the session was cancelled — bail.

  const playFrom = useCallback((idx: number, gen: number) => {
    if (gen !== genRef.current) return; // session cancelled

    const segs   = audiosRef.current;
    const blks   = blocksRef.current;

    if (idx >= segs.length) {
      dbg('■ done', '#a78bfa');
      setStatus('paused');
      setDone(true);
      return;
    }

    setSegIdx(idx);
    const audio = segs[idx];

    if (!audio) {
      // emberpause or a media block that failed to fetch — just wait and advance
      const ms = blks[idx]?.durationMs ?? 2000;
      const label = blks[idx]?.type === 'emberpause' ? `⏸ pause ${ms}ms` : `⏭ skipped`;
      dbg(`  [${idx}] ${label}`, '#60a5fa');
      setTimeout(() => playFrom(idx + 1, gen), ms);
      return;
    }

    currentAudio.current = audio;
    dbg(`  [${idx}] ▶ playing`, '#4ade80');

    audio.addEventListener('ended', () => {
      dbg(`  [${idx}] ✓ ended`, '#4ade80');
      playFrom(idx + 1, gen);
    }, { once: true });

    audio.addEventListener('error', () => {
      dbg(`  [${idx}] ✗ audio error`, '#f87171');
      playFrom(idx + 1, gen);
    }, { once: true });

    audio.play().catch((e: unknown) => {
      dbg(`  [${idx}] ✗ play() rejected: ${e instanceof Error ? e.message : String(e)}`, '#f87171');
      playFrom(idx + 1, gen);
    });
  }, [dbg]);

  // ─── Save story to DB ────────────────────────────────────────────────────

  const saveStory = useCallback(async (content: string) => {
    if (!emberId || savedRef.current) return;
    savedRef.current = true;
    const facetKeys  = Array.from(selectedKeys).filter((k) => k !== 'snapshot' && !taggedNames.includes(k));
    const personKeys = Array.from(selectedKeys).filter((k) => taggedNames.includes(k));
    const tqs = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
    try {
      await fetch(`/api/embers/${encodeURIComponent(emberId)}/stories${tqs}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: content, facets: facetKeys, people: personKeys, durationSeconds }),
      });
    } catch { /* non-blocking */ }
  }, [emberId, accessToken, selectedKeys, taggedNames, durationSeconds]);

  // ─── Main toggle handler ─────────────────────────────────────────────────

  const handleToggle = useCallback(async () => {
    if (status === 'loading') return;

    // Pause
    if (status === 'playing') {
      currentAudio.current?.pause();
      setStatus('paused');
      return;
    }

    // Resume (mid-playback, not done)
    if (status === 'paused' && !done && currentAudio.current) {
      currentAudio.current.play().catch(() => {});
      setStatus('playing');
      return;
    }

    // ── Start a fresh session ──────────────────────────────────────────────
    if (!emberId) return;

    dispose(); // increment gen, stop old audio, free old URLs
    setError('');
    setDone(false);
    setDebugLog([]);
    savedRef.current = false;

    const gen = genRef.current; // capture AFTER dispose() so it matches
    const tqs = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';

    const facetKeys  = Array.from(selectedKeys).filter((k) => k !== 'snapshot' && !taggedNames.includes(k));
    const personKeys = Array.from(selectedKeys).filter((k) => taggedNames.includes(k));
    const isSnapshot = selectedKeys.has('snapshot') && selectedKeys.size === 1;

    setStatus('loading');

    // ── Step 1: get blocks (playlist) or script ────────────────────────────
    let activeBlocks = blocks;
    let activeScript = script;

    if (!activeBlocks && !activeScript) {
      if (isSnapshot) {
        if (!storyScript) { setError('No snapshot yet.'); setStatus('idle'); return; }
        activeScript = storyScript;
        setScript(activeScript);
      } else {
        if (facetKeys.length === 0 && personKeys.length === 0) {
          setError('Select at least one facet or person.');
          setStatus('idle');
          return;
        }

        // Try playlist (clips + narration) when a person is selected
        if (personKeys.length > 0) {
          try {
            const res = await fetch(
              `/api/embers/${encodeURIComponent(emberId)}/stories/playlist${tqs}`,
              { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ facets: facetKeys, people: personKeys, durationSeconds }) }
            );
            if (res.ok) {
              const payload = await res.json().catch(() => null) as { blocks?: Block[] | null } | null;
              if (Array.isArray(payload?.blocks) && payload.blocks.length > 0) {
                activeBlocks = payload.blocks;
                setBlocks(activeBlocks);
                dbg(`▶ playlist: ${activeBlocks.length} blocks`, '#a78bfa');
              }
            }
          } catch { /* fall through to compose */ }
        }

        // Fall back to pure narration
        if (!activeBlocks) {
          try {
            const res = await fetch(
              `/api/embers/${encodeURIComponent(emberId)}/stories/compose${tqs}`,
              { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ facets: facetKeys, people: personKeys, durationSeconds }) }
            );
            const payload = await res.json().catch(() => null) as { script?: string } | null;
            if (!res.ok) throw new Error(payload?.script ?? 'Failed to compose story.');
            activeScript = payload?.script ?? '';
            setScript(activeScript);
            dbg('▶ compose: script ready', '#a78bfa');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to compose story.');
            setStatus('idle');
            return;
          }
        }
      }
    }

    if (gen !== genRef.current) return; // cancelled while composing

    // ── Step 2: fetch audio ────────────────────────────────────────────────

    if (activeBlocks) {
      // Playlist mode — fetch each block's audio individually, in parallel
      const sorted = [...activeBlocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      blocksRef.current = sorted;

      dbg(`fetching ${sorted.length} segments…`, 'rgba(255,255,255,0.4)');
      sorted.forEach((b, i) => {
        const lbl = b.type === 'voice'      ? `voice "${(b.content ?? '').slice(0, 35)}…"`
                  : b.type === 'emberpause' ? `pause ${b.durationMs ?? 2000}ms`
                  : `media [${b.speaker ?? b.mediaId?.slice(0, 8) ?? '?'}]`;
        dbg(`  [${i}] ${lbl}`, 'rgba(255,255,255,0.3)');
      });

      const blobsOrNull = await Promise.all(
        sorted.map(async (block, i) => {
          if (block.type === 'emberpause') return null;
          try {
            const res = await fetch(
              `/api/embers/${encodeURIComponent(emberId)}/snapshot-audio${tqs}`,
              { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blocks: [block] }) }
            );
            if (!res.ok) {
              const p = await res.json().catch(() => null) as { error?: string } | null;
              dbg(`  [${i}] ✗ ${(p?.error ?? `HTTP ${res.status}`).slice(0, 100)}`, '#f87171');
              return null;
            }
            const blob = await res.blob();
            dbg(`  [${i}] ✓ ${(blob.size / 1024).toFixed(0)} KB`, '#4ade80');
            return blob;
          } catch (e) {
            dbg(`  [${i}] ✗ ${e instanceof Error ? e.message : String(e)}`.slice(0, 100), '#f87171');
            return null;
          }
        })
      );

      if (gen !== genRef.current) return; // cancelled while fetching

      if (!blobsOrNull.some(Boolean)) {
        setError('All audio segments failed to load.');
        setStatus('idle');
        return;
      }

      const urls   = blobsOrNull.map((b) => b ? URL.createObjectURL(b) : null);
      const audios = urls.map((u) => {
        if (!u) return null;
        const a = new Audio(u); a.preload = 'auto'; return a;
      });

      audiosRef.current = audios;
      urlsRef.current   = urls.filter(Boolean) as string[];

      // Wire first real audio element to AudioContext for the visualizer
      const firstReal = audios.find(Boolean);
      if (firstReal) {
        try {
          const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (Ctor) {
            const ctx = new Ctor();
            const src = ctx.createMediaElementSource(firstReal);
            const an  = ctx.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = 0.8;
            src.connect(an); an.connect(ctx.destination);
            audioCtxRef.current = ctx; analyserRef.current = an;
          }
        } catch { /* no visualizer */ }
      }

      setStatus('playing');
      playFrom(0, gen);

      // Save story (non-blocking)
      const segments = sorted
        .filter((b) => b.type === 'voice' || b.type === 'media')
        .map((b) => b.type === 'voice'
          ? { type: 'narration', text: b.content ?? '' }
          : { type: b.clipKind === 'call' ? 'call-clip' : 'voice-clip', speaker: b.speaker ?? 'Contributor', text: b.quote ?? '' }
        );
      if (segments.length > 0) void saveStory(JSON.stringify(segments));

    } else if (activeScript) {
      // Single-script mode — one concatenated audio file
      dbg('fetching single-script audio…', 'rgba(255,255,255,0.4)');
      try {
        const res = await fetch(
          `/api/embers/${encodeURIComponent(emberId)}/snapshot-audio${tqs}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script: activeScript }) }
        );
        if (!res.ok) {
          const p = await res.json().catch(() => null) as { error?: string } | null;
          throw new Error(p?.error ?? `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        dbg(`✓ ${(blob.size / 1024).toFixed(0)} KB`, '#4ade80');

        if (gen !== genRef.current) return;

        const url   = URL.createObjectURL(blob);
        const audio = new Audio(url); audio.preload = 'auto';

        urlsRef.current   = [url];
        audiosRef.current = [audio];
        blocksRef.current = [{ type: 'voice', content: activeScript, durationMs: 0 }];

        try {
          const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (Ctor) {
            const ctx = new Ctor();
            const src = ctx.createMediaElementSource(audio);
            const an  = ctx.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = 0.8;
            src.connect(an); an.connect(ctx.destination);
            audioCtxRef.current = ctx; analyserRef.current = an;
          }
        } catch { /* no visualizer */ }

        setStatus('playing');
        playFrom(0, gen);
        void saveStory(activeScript);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load audio.');
        setStatus('idle');
      }
    }
  }, [
    status, done, emberId, accessToken, selectedKeys, taggedNames,
    blocks, script, storyScript, durationSeconds,
    dispose, playFrom, saveStory, dbg,
  ]);

  // ─── Derived display data ─────────────────────────────────────────────────

  // Segments to display (playlist mode only) — parallel to audiosRef
  const displaySegments = useMemo(() => {
    if (!blocks) return null;
    return [...blocks]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((b) =>
        b.type === 'voice'      ? { text: b.content ?? '', speaker: undefined } :
        b.type === 'media'      ? { text: b.quote   ?? '', speaker: b.speaker } :
        /* emberpause */          { text: '',              speaker: undefined }
      );
  }, [blocks]);

  // Single-script display lines
  const scriptLines = useMemo(() => {
    const text = script?.replace(/\s+/g, ' ').trim();
    if (!text) return [];
    const chunks: string[] = [];
    for (const sentence of text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)) {
      let cur = '';
      for (const word of sentence.split(' ').filter(Boolean)) {
        const next = cur ? `${cur} ${word}` : word;
        if (next.length > 40 && cur) { chunks.push(cur); cur = word; } else { cur = next; }
      }
      if (cur) chunks.push(cur);
    }
    return chunks.slice(0, 6);
  }, [script]);

  const facets: Facet[] = useMemo(() => {
    const result: Facet[] = [];
    for (const tf of TOPIC_FACETS) {
      const available = tf.key === 'place'
        ? (availableClaimTypes.has('place') || hasConfirmedLocation)
        : availableClaimTypes.has(tf.key);
      if (available) result.push({ ...tf });
    }
    for (const name of taggedNames) {
      result.push({ key: name, label: name, color: RED, vizColor: '#f87171', isPerson: true });
    }
    if (storyScript) result.push(SNAPSHOT_FACET);
    return result;
  }, [availableClaimTypes, taggedNames, storyScript, hasConfirmedLocation]);

  const vizColor = useMemo(() => {
    if (selectedKeys.has('snapshot')) return SNAPSHOT_FACET.vizColor;
    const hasTopic  = facets.some((f) => !f.isPerson && !f.isSnapshot && selectedKeys.has(f.key));
    const hasPerson = facets.some((f) =>  f.isPerson && selectedKeys.has(f.key));
    if (hasTopic && hasPerson) return '#a78bfa';
    if (hasTopic)  return '#60a5fa';
    if (hasPerson) return '#f87171';
    return SNAPSHOT_FACET.vizColor;
  }, [facets, selectedKeys]);

  // ─── Effects ─────────────────────────────────────────────────────────────

  // Fetch chip data when sheet opens
  useEffect(() => {
    if (!isOpen || !emberId) return;
    let cancelled = false;
    const tqs = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';

    fetch(`/api/embers/${encodeURIComponent(emberId)}/reconciliation${tqs}`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { claims?: Array<{ claimType: string }> } | null) => {
        if (cancelled || !d?.claims) return;
        setAvailableClaimTypes(new Set(d.claims.map((c) => c.claimType)));
      }).catch(() => {});

    fetch(`/api/embers/${encodeURIComponent(emberId)}/stories/clips-availability${tqs}`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { voiceSpeakers?: string[]; callSpeakers?: string[] } | null) => {
        if (cancelled) return;
        if (d?.voiceSpeakers) setVoiceClipSpeakers(d.voiceSpeakers);
        if (d?.callSpeakers)  setCallClipSpeakers(d.callSpeakers);
      }).catch(() => {});

    fetch(`/api/embers/${encodeURIComponent(emberId)}${tqs}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: {
        tags?: Array<{ user?: { firstName?: string | null } | null; emberContributor?: { user?: { firstName?: string | null } | null } | null; label?: string | null }>;
        contributors?: Array<{ name?: string | null; voiceCalls?: unknown[]; conversation?: unknown }>;
        analysis?: { confirmedLocation?: { label?: string | null } | null; latitude?: number | null; longitude?: number | null } | null;
      }) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const names: string[] = [];
        const addName = (raw?: string | null) => {
          const first = (raw ?? '').trim().split(/\s+/)[0];
          if (!first) return;
          const key = first.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key); names.push(first);
        };
        for (const t of d?.tags ?? []) addName(t.user?.firstName ?? t.emberContributor?.user?.firstName ?? t.label);
        for (const c of d?.contributors ?? []) {
          if (c.name && (Array.isArray(c.voiceCalls) && c.voiceCalls.length > 0 || c.conversation != null))
            addName(c.name);
        }
        setTaggedNames(names);
        setHasConfirmedLocation(
          Boolean(d?.analysis?.confirmedLocation?.label) ||
          (d?.analysis?.latitude != null && d?.analysis?.longitude != null)
        );
      }).catch(() => {});

    return () => { cancelled = true; };
  }, [isOpen, emberId, accessToken]);

  // Slide in/out + full reset on close
  useEffect(() => {
    if (isOpen) {
      setShowing(true);
    } else {
      setShowing(false);
      dispose();
      setStatus('idle'); setError(''); setDone(false);
      setSegIdx(0); setScript(null); setBlocks(null);
      setSelectedKeys(new Set(['snapshot']));
      setDebugLog([]);
      savedRef.current = false;
    }
  }, [isOpen, dispose]);

  // Idle prompt cycling
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
  }, [isOpen]);

  // ─── Chip toggle ─────────────────────────────────────────────────────────

  const toggleKey = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); }
      else {
        next.add(key);
        if (key === 'snapshot') { for (const k of next) { if (k !== 'snapshot') next.delete(k); } }
        else { next.delete('snapshot'); }
      }
      if (next.size === 0) next.add('snapshot');
      return next;
    });
    dispose();
    setStatus('idle'); setError(''); setDone(false);
    setSegIdx(0); setScript(null); setBlocks(null);
    setDebugLog([]);
    savedRef.current = false;
  }, [dispose]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const isPlaying  = status === 'playing';
  const isLoading  = status === 'loading';
  const curSeg     = displaySegments?.[segIdx];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-10 flex flex-col"
      style={{
        height: SHEET_H, background: 'var(--bg-sheets)',
        borderTop: '1px solid var(--border-subtle)', borderRadius: '20px 20px 0 0',
        transform: showing ? 'translateY(0)' : 'translateY(100%)',
        transition: `transform ${SNAP_MS}ms cubic-bezier(0.4,0,0.2,1)`,
      }}
    >
      {/* ── Play / pause button ── */}
      {isOpen ? (
        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={isLoading}
          className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full [@media(hover:hover)]:hover:brightness-110 [@media(hover:hover)]:hover:scale-105 transition-[filter,transform,background] duration-150"
          style={{ top: -24, width: 48, height: 48, background: vizColor, border: '6px solid var(--bg-sheets)', cursor: isLoading ? 'default' : 'pointer' }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <svg width={20} height={20} viewBox="0 0 72 72" fill="white" className="animate-spin">
              <circle cx="36" cy="36" r="7.2" />
              <rect x="32.4" y="3.18"  width="7.2" height="21.6" rx="3.6" />
              <rect x="32.4" y="47.22" width="7.2" height="21.6" rx="3.6" />
              <rect x="10.38" y="25.2" width="7.2" height="21.6" rx="3.6" transform="translate(-22.02 49.98) rotate(-90)" />
              <rect x="54.42" y="25.2" width="7.2" height="21.6" rx="3.6" transform="translate(22.02 94.02) rotate(-90)" />
              <rect x="47.97" y="9.63"  width="7.2" height="21.6" rx="3.6" transform="translate(29.55 -30.48) rotate(45)" />
              <rect x="16.83" y="40.77" width="7.2" height="21.6" rx="3.6" transform="translate(42.45 .66) rotate(45)" />
              <rect x="16.83" y="9.63"  width="7.2" height="21.6" rx="3.6" transform="translate(-8.46 20.43) rotate(-45)" />
              <rect x="47.97" y="40.77" width="7.2" height="21.6" rx="3.6" transform="translate(-21.36 51.57) rotate(-45)" />
            </svg>
          ) : isPlaying ? (
            <Pause size={18} color="#ffffff" strokeWidth={2} fill="#ffffff" />
          ) : (
            <Play  size={18} color="#ffffff" strokeWidth={2} fill="#ffffff" />
          )}
        </button>
      ) : null}

      {/* ── Header ── */}
      <div className="flex items-center px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-header)' }}>
        <Flame size={18} color="white" strokeWidth={1.6} />
        <span className="flex-1 ml-2 text-white font-semibold text-base">stories</span>
        <button type="button" className="cursor-pointer" onClick={() => { setShowing(false); setTimeout(onClose, SNAP_MS); }}>
          <X size={20} color="var(--text-secondary)" strokeWidth={1.8} />
        </button>
      </div>

      {/* ── Error ── */}
      {error ? (
        <p className="text-xs text-center px-4 mt-1 flex-shrink-0" style={{ color: 'rgba(255,100,100,0.8)' }}>
          {error}
        </p>
      ) : null}

      {/* ── Debug log ── */}
      {debugLog.length > 0 ? (
        <div
          className="flex-shrink-0 mx-3 mt-1 rounded-lg overflow-y-auto"
          style={{ maxHeight: 160, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 8px' }}
        >
          {debugLog.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, lineHeight: 1.35 }}>
              <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', flexShrink: 0, fontVariantNumeric: 'tabular-nums', paddingTop: 1 }}>{e.ts}</span>
              <span style={{ fontSize: '0.65rem', color: e.color, wordBreak: 'break-all' }}>{e.text}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Body ── */}
      <div className="absolute left-0 right-0 bottom-0 px-4 flex flex-col pointer-events-none [&_button]:pointer-events-auto" style={{ top: 56 }}>

        {/* Story text */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center mb-5 pointer-events-none">
            {isPlaying ? (
              displaySegments && curSeg ? (
                <>
                  {curSeg.speaker ? (
                    <p className="font-normal leading-snug text-center mb-1" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                      {curSeg.speaker}
                    </p>
                  ) : null}
                  <p className="font-medium leading-snug text-center" style={{ fontSize: '1.2rem', color: curSeg.speaker ? '#4ade80' : 'rgba(255,255,255,0.85)' }}>
                    {curSeg.text}
                  </p>
                  <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
                    {segIdx + 1} / {displaySegments.length}
                  </p>
                </>
              ) : scriptLines.length > 0 ? (
                <p className="font-medium leading-snug text-center" style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.85)' }}>
                  {scriptLines[0]}
                </p>
              ) : null
            ) : (
              <p className="font-medium leading-snug" style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.6)', opacity: idlePromptVisible ? 1 : 0, transition: 'opacity 0.6s ease' }}>
                {IDLE_PROMPTS[idlePromptIdx]}
              </p>
            )}
          </div>

          {/* Visualizer */}
          <div className="flex justify-center mb-3 w-full" style={{ minHeight: 20 }}>
            {isPlaying ? (
              <MicLevelMeter analyser={analyserRef.current} color={vizColor} bars={22} className="w-[70%] h-5" />
            ) : null}
          </div>
        </div>

        {/* Chip row */}
        <div className="flex flex-wrap justify-center gap-2 pb-4">
          {facets.map((facet) => {
            const isSelected = selectedKeys.has(facet.key);
            const matchesSpeaker = (list: string[]) =>
              !!facet.isPerson && list.some((s) => {
                const sf = s.toLowerCase().split(' ')[0];
                const cf = facet.key.toLowerCase().split(' ')[0];
                return sf === cf || s.toLowerCase().includes(facet.key.toLowerCase());
              });
            return (
              <button
                key={facet.key}
                type="button"
                onClick={() => toggleKey(facet.key)}
                className="flex-shrink-0 flex items-center justify-center gap-1.5 rounded-full px-4 text-sm font-normal cursor-pointer [@media(hover:hover)]:hover:brightness-125 [@media(hover:hover)]:hover:scale-105 transition-[filter,transform,background] duration-150"
                style={{
                  height: 26,
                  background: isSelected ? (vizColor === '#a78bfa' ? PURPLE : facet.color) : 'var(--bg-drill-blocks)',
                  border: '1px solid var(--border-subtle)', color: 'rgba(255,255,255,0.7)',
                }}
              >
                {facet.isSnapshot ? <ScanEye size={12} strokeWidth={2} /> : null}
                {matchesSpeaker(callClipSpeakers)  ? <Phone size={11} strokeWidth={2} style={{ opacity: 0.7 }} /> : null}
                {matchesSpeaker(voiceClipSpeakers) ? <Mic   size={11} strokeWidth={2} style={{ opacity: 0.7 }} /> : null}
                {facet.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
