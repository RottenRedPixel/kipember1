'use client';

import { Flame, Mic, Pause, Phone, Play, ScanEye, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MicLevelMeter from '@/components/kipember/workflows/MicLevelMeter';
import { useResetZoomOnOpen } from '@/lib/reset-zoom';

const SHEET_H = '40vh';
const SNAP_MS = 320;

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Facet definition — what shows in the chip row.
type Facet = {
  key: string;       // claimType key OR person first-name OR 'snapshot'
  label: string;     // display text
  color: string;     // highlight background when selected
  vizColor: string;  // play-button / visualizer colour
  isPerson?: boolean;
  isSnapshot?: boolean;
};

const ORANGE  = 'rgba(249,115,22,0.6)';
const BLUE    = 'rgba(96,165,250,0.6)';
const RED     = 'rgba(248,113,113,0.6)';
const PURPLE  = 'rgba(167,139,250,0.6)';

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
  const [hasConfirmedLocation, setHasConfirmedLocation] = useState(false);

  // Speakers split by clip type — used to show the right icon on person chips
  // and to gate the playlist-mode hard-stop when clips exist.
  const [voiceClipSpeakers, setVoiceClipSpeakers] = useState<string[]>([]);
  const [callClipSpeakers,  setCallClipSpeakers]  = useState<string[]>([]);

  // Which facet keys the user has selected.
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set(['snapshot']));

  // The composed script for the current selection (null = not yet composed).
  const [composedScript, setComposedScript] = useState<string | null>(null);

  // Playlist blocks (narration + clips) — set when playlist mode was used.
  // Mutually exclusive with composedScript.
  const [composedBlocks, setComposedBlocks] = useState<unknown[] | null>(null);

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
      // Place chip shows if confirmed location exists OR extractor place claims exist.
      const available = tf.key === 'place'
        ? (availableClaimTypes.has('place') || hasConfirmedLocation)
        : availableClaimTypes.has(tf.key);
      if (available) result.push(tf);
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
  }, [availableClaimTypes, taggedNames, storyScript, hasConfirmedLocation]);

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

  // Single-script display (snapshot / compose modes) — flat text split into lines.
  const activeScript = useMemo(() => {
    if (composedScript) return composedScript;
    return null;
  }, [composedScript]);
  const storyLines = useMemo(() => buildStoryLines(activeScript), [activeScript]);

  // Playlist mode: ordered segments with cumulative estimated durations.
  // durationMs from the playlist route — clips are exact Whisper timestamps,
  // narrator is a word-count estimate. durationSec is stored per-segment so
  // the timeupdate handler can hold on contributor clips for their full duration.
  const displaySegmentsRef  = useRef<Array<{ text: string; speaker?: string; cumStart: number; durationSec: number }> | null>(null);
  const totalEstSecRef       = useRef(0);
  const displaySegments = useMemo(() => {
    if (!composedBlocks) { displaySegmentsRef.current = null; totalEstSecRef.current = 0; return null; }
    type B = {
      type: string;
      content?: string;
      speaker?: string;
      quote?: string;
      durationMs?: number;
      clipStartMs?: number;
      clipEndMs?: number;
      order?: number;
    };
    let cumSec = 0;
    const segs: Array<{ text: string; speaker?: string; cumStart: number; durationSec: number }> = [];
    for (const b of (composedBlocks as B[]).slice().sort((a, bn) => (a.order ?? 0) - (bn.order ?? 0))) {
      if (b.type === 'voice' && b.content) {
        const dur = b.durationMs != null
          ? b.durationMs / 1000
          : Math.max(0.5, b.content.trim().split(/\s+/).length / 2.5);
        segs.push({ text: b.content, cumStart: cumSec, durationSec: dur });
        cumSec += dur;
      } else if (b.type === 'media' && b.quote) {
        const dur = b.durationMs != null
          ? b.durationMs / 1000
          : b.clipStartMs != null && b.clipEndMs != null
            ? Math.max(0.5, (b.clipEndMs - b.clipStartMs) / 1000)
            : Math.max(0.5, b.quote.trim().split(/\s+/).length / 2.0);
        segs.push({ text: b.quote, speaker: b.speaker, cumStart: cumSec, durationSec: dur });
        cumSec += dur;
      }
    }
    totalEstSecRef.current = cumSec;
    const result = segs.length > 0 ? segs : null;
    displaySegmentsRef.current = result;
    return result;
  }, [composedBlocks]);

  const [currentSegmentIdx, setCurrentSegmentIdx] = useState(0);

  // Timer-based line scroll is only used for single-script mode.
  // In playlist mode the timeupdate effect drives both paths.
  const shouldAnimate = playbackState === 'playing' && !done && !displaySegments;
  const isPlaying = playbackState === 'playing';

  // ── Audio refs ───────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // ── Timeline refs (DOM-mutated directly to avoid per-frame re-renders) ───
  const timelineFilledRef = useRef<HTMLDivElement>(null);
  const timelineDotRef    = useRef<HTMLDivElement>(null);
  const timelineCurRef    = useRef<HTMLSpanElement>(null);
  const timelineEndRef    = useRef<HTMLSpanElement>(null);

  // ── Clip-hold refs — track which segment is active and when a clip started ─
  // currentSegmentIdxRef mirrors the currentSegmentIdx state so the timeupdate
  // handler can read the latest value without a stale closure.
  // clipEnteredAtRef holds the audio.currentTime when we first entered a
  // contributor clip; -1 means we're in a narrator segment (no hold needed).
  const currentSegmentIdxRef = useRef(0);
  const clipEnteredAtRef     = useRef(-1);

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

  // ── Audio-driven text sync ────────────────────────────────────────────────
  // Playlist mode logic:
  //  • Narrator segments advance via proportional mapping
  //    (estimated cumStart / totalEstSec vs actual currentTime / duration).
  //  • Contributor clip segments are held for their full Whisper-measured
  //    durationSec from the moment they first become active. This prevents
  //    narrator drift from skipping over real voice/call clips.
  useEffect(() => {
    const audio = audioRef.current;
    if (!isPlaying || !audio) return;

    const onTimeUpdate = () => {
      const t = audio.currentTime;
      const segs = displaySegmentsRef.current;
      const totalEst = totalEstSecRef.current;

      if (segs && totalEst > 0) {
        const dur = audio.duration;
        if (!dur || !isFinite(dur)) return;

        const curIdx = currentSegmentIdxRef.current;
        const curSeg = segs[curIdx];

        // ── Clip-hold: if we're on a contributor segment, don't advance
        // until the clip's full Whisper duration has elapsed.
        if (curSeg?.speaker) {
          if (clipEnteredAtRef.current < 0) {
            // First timeupdate tick inside this clip — record the start time.
            clipEnteredAtRef.current = t;
          }
          if (t < clipEnteredAtRef.current + curSeg.durationSec) {
            return; // Clip still playing — hold here.
          }
        }

        // ── Proportional advancement for narrator (or after clip finishes) ──
        const progress = t / dur;
        let idx = 0;
        for (let i = segs.length - 1; i >= 0; i--) {
          if (progress >= segs[i].cumStart / totalEst) { idx = i; break; }
        }
        // Never go backwards (clip-hold can leave progress ahead of cumStart).
        idx = Math.max(idx, curIdx);

        if (idx !== curIdx) {
          // Reset clip tracking for the new segment (will be recorded on the
          // first tick if the new segment is also a clip).
          clipEnteredAtRef.current = -1;
          currentSegmentIdxRef.current = idx;
          setCurrentSegmentIdx(idx);
        }
      } else if (storyLines.length > 0) {
        // Single-script mode: proportional line advance
        const dur = audio.duration;
        if (!dur || !isFinite(dur)) return;
        const pairs = Math.ceil(storyLines.length / 2);
        const targetPair = Math.min(Math.floor((t / dur) * pairs), pairs - 1);
        setLineIndex(targetPair * 2);
      }
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    return () => audio.removeEventListener('timeupdate', onTimeUpdate);
  }, [isPlaying, storyLines.length]);

  // ── Timeline DOM updates (direct mutation — no React re-render per tick) ─
  useEffect(() => {
    const audio = audioRef.current;
    if (!isPlaying || !audio) return;
    const onUpdate = () => {
      const t = audio.currentTime;
      const d = audio.duration;
      if (!d || !isFinite(d)) return;
      const pct = Math.min(t / d, 1) * 100;
      if (timelineFilledRef.current) timelineFilledRef.current.style.width = `${pct}%`;
      if (timelineDotRef.current)    timelineDotRef.current.style.left    = `${pct}%`;
      if (timelineCurRef.current)    timelineCurRef.current.textContent   = formatTime(t);
      if (timelineEndRef.current)    timelineEndRef.current.textContent   = formatTime(d);
    };
    audio.addEventListener('timeupdate', onUpdate);
    return () => audio.removeEventListener('timeupdate', onUpdate);
  }, [isPlaying]);

  // ── Fetch available claim types + tagged names when sheet opens ──────────
  useEffect(() => {
    if (!isOpen || !emberId) return;
    let cancelled = false;

    const tqs = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';

    // Fetch claim types from reconciliation endpoint
    fetch(`/api/embers/${encodeURIComponent(emberId)}/reconciliation${tqs}`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { claims?: Array<{ claimType: string }> } | null) => {
        if (cancelled || !d?.claims) return;
        setAvailableClaimTypes(new Set(d.claims.map((c) => c.claimType)));
      })
      .catch(() => {});

    // Fetch which speakers have real recorded clips, split by clip type
    fetch(`/api/embers/${encodeURIComponent(emberId)}/stories/clips-availability${tqs}`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { voiceSpeakers?: string[]; callSpeakers?: string[] } | null) => {
        if (cancelled) return;
        if (d?.voiceSpeakers) setVoiceClipSpeakers(d.voiceSpeakers);
        if (d?.callSpeakers)  setCallClipSpeakers(d.callSpeakers);
      })
      .catch(() => {});

    // Fetch tagged people names + contributor names + confirmed location
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

        const addName = (raw: string | null | undefined) => {
          const first = (raw ?? '').toString().trim().split(/\s+/)[0];
          if (!first) return;
          const key = first.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          names.push(first);
        };

        // Tagged people in the photo
        for (const t of Array.isArray(d?.tags) ? d.tags : []) {
          addName(t.user?.firstName ?? t.emberContributor?.user?.firstName ?? t.label);
        }

        // Contributors who have left chat, voice, or call contributions.
        // Only include if they have voiceCalls OR a conversation session —
        // this filters out invited-but-never-contributed people.
        for (const c of Array.isArray(d?.contributors) ? d.contributors : []) {
          const hasCall = Array.isArray(c.voiceCalls) && c.voiceCalls.length > 0;
          const hasSession = c.conversation !== null && c.conversation !== undefined;
          if (c.name && (hasCall || hasSession)) addName(c.name);
        }

        setTaggedNames(names);
        // Show place chip if the location was explicitly confirmed OR if GPS
        // coordinates are present (wiki resolves place from coords via reverse geocoding).
        setHasConfirmedLocation(
          Boolean(d?.analysis?.confirmedLocation?.label) ||
          (d?.analysis?.latitude != null && d?.analysis?.longitude != null)
        );
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [isOpen, emberId, accessToken]);

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
      setComposedBlocks(null);
      setSelectedKeys(new Set(['snapshot']));
      setError('');
      setCurrentSegmentIdx(0);
      currentSegmentIdxRef.current = 0;
      clipEnteredAtRef.current = -1;
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
    // Changing selection invalidates any cached composition.
    disposeAudio();
    setPlaybackState('idle');
    setComposedScript(null);
    setComposedBlocks(null);
    setLineIndex(0);
    setFading(false);
    setDone(false);
    setError('');
    setCurrentSegmentIdx(0);
    currentSegmentIdxRef.current = 0;
    clipEnteredAtRef.current = -1;
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
    const tokenQs = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
    try {
      await fetch(`/api/embers/${encodeURIComponent(emberId)}/stories${tokenQs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, facets: facetKeys, people: personKeys, durationSeconds }),
      });
    } catch { /* non-blocking */ }
  }, [emberId, accessToken, selectedKeys, taggedNames, durationSeconds]);

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

    const facetKeys = Array.from(selectedKeys).filter((k) => k !== 'snapshot' && !taggedNames.includes(k));
    const personKeys = Array.from(selectedKeys).filter((k) => taggedNames.includes(k));

    let script = composedScript;
    let blocks = composedBlocks;


    if (!script && !blocks) {
      if (isSnapshotMode || (!hasNonSnapshot && storyScript)) {
        // Snapshot shortcut — use the pre-generated script
        if (!storyScript) { setError('No snapshot yet.'); return; }
        script = storyScript;
        setComposedScript(script);
      } else {
        if (facetKeys.length === 0 && personKeys.length === 0) {
          setError('Select at least one facet or person.');
          return;
        }

        setPlaybackState('composing');

        // Determine if any selected person has real recorded clips.
        // When clips exist, using them is MANDATORY — we never fall back to
        // pure narration for a contributor who has left real audio.
        const allClipSpeakers = [...voiceClipSpeakers, ...callClipSpeakers];
        const selectedHaveClips = personKeys.some((p) =>
          allClipSpeakers.some((s) => s.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(s.toLowerCase().split(' ')[0]))
        );

        // Always try the playlist endpoint when people are selected —
        // it guarantees clips are included if they exist.
        if (personKeys.length > 0 || facetKeys.length > 0) {
          try {
            const playlistTokenQs = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
            const playlistRes = await fetch(
              `/api/embers/${encodeURIComponent(emberId)}/stories/playlist${playlistTokenQs}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ facets: facetKeys, people: personKeys, durationSeconds }),
              }
            );
            if (playlistRes.ok) {
              const playlistPayload = await playlistRes.json().catch(() => null) as { blocks?: unknown[] | null } | null;
              if (Array.isArray(playlistPayload?.blocks) && playlistPayload.blocks.length > 0) {
                blocks = playlistPayload.blocks;
                setComposedBlocks(blocks);
              }
            }
          } catch { /* non-fatal */ }
        }

        // If selected person has clips but playlist failed — hard stop.
        // Do NOT silently drop to a clip-free narration.
        if (!blocks && selectedHaveClips) {
          setPlaybackState('idle');
          setError('Could not load voice clips. Please try again.');
          return;
        }

        // No clips for this selection — compose pure narration
        if (!blocks) {
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
    }

    // Fetch audio — pass blocks if we have them, otherwise a plain script
    setPlaybackState('loading');
    try {
      const tokenQs = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
      const audioBody = blocks ? { blocks } : { script };
      const response = await fetch(
        `/api/embers/${encodeURIComponent(emberId)}/snapshot-audio${tokenQs}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(audioBody),
        }
      );
      if (!response.ok) {
        const p = await response.json().catch(() => null);
        throw new Error(p?.error ?? 'Audio not available.');
      }
      const blob = await response.blob();
      const audio = await buildAudioFromBlob(blob);
      // Reset clip-hold state for a fresh play session.
      currentSegmentIdxRef.current = 0;
      clipEnteredAtRef.current = -1;
      setCurrentSegmentIdx(0);
      await audio.play();
      if (script) {
        void saveStory(script);
      } else if (blocks) {
        // Playlist mode — build a structured script that interleaves Ember
        // narrator text with contributor voice/call transcripts, sorted by
        // playback order. Saved as JSON so the wiki can render each segment
        // with its own colour (narrator = muted, voice-clip = green, call-clip = blue).
        type PlaylistBlock =
          | { type: 'voice'; content?: string; order?: number }
          | { type: 'media'; clipKind?: 'voice' | 'call'; speaker?: string; quote?: string; order?: number };
        const segments = (blocks as PlaylistBlock[])
          .slice()
          .sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)))
          .flatMap((b): { type: string; speaker?: string; text: string }[] => {
            if (b.type === 'voice' && b.content) {
              return [{ type: 'narration', text: b.content }];
            }
            if (b.type === 'media' && b.quote) {
              return [{
                type: b.clipKind === 'call' ? 'call-clip' : 'voice-clip',
                speaker: b.speaker ?? 'Contributor',
                text: b.quote,
              }];
            }
            return [];
          });
        if (segments.length > 0) void saveStory(JSON.stringify(segments));
      }
    } catch (err) {
      setPlaybackState('paused');
      setError(err instanceof Error ? err.message : 'Audio could not be played.');
    }
  }, [
    playbackState, emberId, selectedKeys, composedScript, composedBlocks,
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
          className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full [@media(hover:hover)]:hover:brightness-110 [@media(hover:hover)]:hover:scale-105 transition-[filter,transform,background] duration-150"
          style={{
            top: -24,
            width: 48,
            height: 48,
            background: vizColor,
            border: '6px solid var(--bg-sheets)',
            cursor: playbackState === 'composing' || playbackState === 'loading' ? 'default' : 'pointer',
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {playbackState === 'composing' || playbackState === 'loading' ? (
            <svg width={20} height={20} viewBox="0 0 72 72" fill="white" className="animate-spin">
              <circle cx="36" cy="36" r="7.2" />
              <rect x="32.4" y="3.18" width="7.2" height="21.6" rx="3.6" ry="3.6" />
              <rect x="32.4" y="47.22" width="7.2" height="21.6" rx="3.6" ry="3.6" />
              <rect x="10.38" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-22.02 49.98) rotate(-90)" />
              <rect x="54.42" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(22.02 94.02) rotate(-90)" />
              <rect x="47.97" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(29.55 -30.48) rotate(45)" />
              <rect x="16.83" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(42.45 .66) rotate(45)" />
              <rect x="16.83" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-8.46 20.43) rotate(-45)" />
              <rect x="47.97" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-21.36 51.57) rotate(-45)" />
            </svg>
          ) : isPlaying ? (
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
                {displaySegments ? (
                  // Playlist mode — show the current segment, colour-coded by speaker type
                  (() => {
                    const seg = displaySegments[currentSegmentIdx];
                    if (!seg) return <p style={{ fontSize: '1.2rem', color: 'transparent' }}>&nbsp;</p>;
                    const segColor = seg.speaker ? '#4ade80' : 'rgba(255,255,255,0.85)';
                    return (
                      <>
                        {seg.speaker ? (
                          <p
                            className="font-normal leading-snug w-full text-center mb-1"
                            style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}
                          >
                            {seg.speaker}
                          </p>
                        ) : null}
                        <p
                          className="font-medium leading-snug w-full text-center"
                          style={{ fontSize: '1.2rem', color: segColor, transition: 'color 0.4s ease' }}
                        >
                          {seg.text}
                        </p>
                        {/* DEBUG: manual advance */}
                        <div className="flex items-center justify-center gap-3 mt-2 pointer-events-auto">
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>
                            {currentSegmentIdx + 1} / {displaySegments.length}
                            {audioRef.current ? ` · t=${audioRef.current.currentTime.toFixed(1)}s / ${(audioRef.current.duration || 0).toFixed(1)}s` : ''}
                            {` · ratio=${((seg as { cumStart: number }).cumStart / Math.max(totalEstSecRef.current, 1)).toFixed(2)}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentSegmentIdx((i) => Math.min(i + 1, displaySegments.length - 1))}
                            style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: '2px 8px' }}
                          >
                            next →
                          </button>
                        </div>
                      </>
                    );
                  })()
                ) : (
                  // Single-script mode — timer-driven two-line scroll
                  <>
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
                  </>
                )}
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
          <div className="flex justify-center mb-3 w-full" style={{ minHeight: 20 }}>
            {isPlaying ? (
              <MicLevelMeter
                analyser={analyserRef.current}
                color={vizColor}
                bars={22}
                className="w-[70%] h-5"
              />
            ) : null}
          </div>

          {/* Playback timeline */}
          {isPlaying ? (
            <div className="w-full px-2 mb-3 pointer-events-none">
              {/* Track */}
              <div className="relative w-full rounded-full" style={{ height: 3, background: 'rgba(255,255,255,0.12)' }}>
                {/* Filled */}
                <div
                  ref={timelineFilledRef}
                  className="absolute left-0 top-0 bottom-0 rounded-full"
                  style={{ width: '0%', background: vizColor, transition: 'width 0.25s linear' }}
                />
                {/* Segment tick marks */}
                {displaySegments && displaySegments.map((seg, i) => {
                  const audio = audioRef.current;
                  const dur = audio?.duration;
                  if (!dur || !isFinite(dur)) return null;
                  const pct = Math.min((seg.cumStart / dur) * 100, 100);
                  return (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0"
                      style={{
                        left: `${pct}%`,
                        width: 2,
                        background: seg.speaker ? '#4ade80' : 'rgba(255,255,255,0.35)',
                        borderRadius: 1,
                      }}
                    />
                  );
                })}
                {/* Playback dot */}
                <div
                  ref={timelineDotRef}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
                  style={{ left: '0%', width: 10, height: 10, background: 'white', boxShadow: '0 0 4px rgba(0,0,0,0.4)' }}
                />
              </div>
              {/* Time labels */}
              <div className="flex justify-between mt-1">
                <span ref={timelineCurRef} style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>0:00</span>
                <span ref={timelineEndRef} style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>--:--</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Facet / person chips */}
        <div className="flex flex-wrap justify-center gap-2 pb-4">
          {facets.map((facet) => {
            const isSelected = selectedKeys.has(facet.key);
            const matchesSpeaker = (list: string[]) =>
              facet.isPerson && list.some((s) => {
                const speakerFirst = s.toLowerCase().split(' ')[0];
                const chipFirst = facet.key.toLowerCase().split(' ')[0];
                return speakerFirst === chipFirst || s.toLowerCase().includes(facet.key.toLowerCase());
              });
            const hasVoiceClip = matchesSpeaker(voiceClipSpeakers);
            const hasCallClip  = matchesSpeaker(callClipSpeakers);
            return (
              <button
                key={facet.key}
                type="button"
                onClick={() => toggleKey(facet.key)}
                className="flex-shrink-0 flex items-center justify-center gap-1.5 rounded-full px-4 text-sm font-normal cursor-pointer [@media(hover:hover)]:hover:brightness-125 [@media(hover:hover)]:hover:scale-105 transition-[filter,transform,background] duration-150"
                style={{
                  height: 26,
                  background: isSelected ? (vizColor === '#a78bfa' ? PURPLE : facet.color) : 'var(--bg-drill-blocks)',
                  border: '1px solid var(--border-subtle)',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                {facet.isSnapshot ? <ScanEye size={12} strokeWidth={2} /> : null}
                {hasCallClip  ? <Phone size={11} strokeWidth={2} style={{ opacity: 0.7 }} /> : null}
                {hasVoiceClip ? <Mic   size={11} strokeWidth={2} style={{ opacity: 0.7 }} /> : null}
                {facet.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
