'use client';

import Link from 'next/link';
import { Heart, MapPinned, ScanEye, Smile, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MicLevelMeter from '@/components/kipember/workflows/MicLevelMeter';

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

// Per-word timing from /snapshot-audio?timings=1 — drives karaoke captions.
type WordTiming = { text: string; startMs: number; endMs: number };

// A word from the source script with its quote-context state and global index.
// The line cascade renders these; karaoke uses the global index to highlight
// the active word in sync with the audio.
type LineWord = { text: string; quoted: boolean; globalIdx: number };

function resetAudioPosition(audio: HTMLAudioElement) {
  audio.currentTime = 0;
}

// Text inside straight double quotes is verbatim contributor speech and is
// rendered in green to make clear which words came from real people vs the
// AI's bridging narration. Curly quotes are normalised first so quotes typed
// by chat users still highlight correctly.
const QUOTE_COLOR = '#4ade80';
const NARRATION_COLOR = '#ffffff';
const MAX_LINE_CHARS = 30;

// Tokenize the script into a sequence of words paired with quote state +
// global index, bucketed into short lines (~30 chars each) that match the
// previous line-cascade layout. Quote state is tracked across the whole
// script so quoted spans that wrap to the next line stay green.
function tokenizeScriptToLines(value: string | null | undefined): {
  lines: LineWord[][];
  flatWords: LineWord[];
} {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text) return { lines: [], flatWords: [] };
  const normalized = text.replace(/[“”]/g, '"');

  // Split into sentences first so line breaks fall on natural boundaries.
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const flat: LineWord[] = [];
  const lines: LineWord[][] = [];
  let inQuote = false;
  let globalIdx = 0;

  for (const sentence of sentences) {
    const tokens = sentence.split(/\s+/).filter(Boolean);
    let currentLine: LineWord[] = [];
    let currentLen = 0;

    for (const token of tokens) {
      // The word is "quoted" if we're inside a quote when it begins.
      const startedInQuote = inQuote;
      for (const ch of token) {
        if (ch === '"') inQuote = !inQuote;
      }
      const quoted = startedInQuote || (token.startsWith('"') && !startedInQuote);
      const word: LineWord = { text: token, quoted, globalIdx };
      flat.push(word);
      globalIdx++;

      const nextLen = currentLen === 0 ? token.length : currentLen + 1 + token.length;
      if (nextLen > MAX_LINE_CHARS && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [word];
        currentLen = token.length;
      } else {
        currentLine.push(word);
        currentLen = nextLen;
      }
    }
    if (currentLine.length > 0) lines.push(currentLine);
  }

  return { lines, flatWords: flat };
}

// Binary-search the timings array for the word whose [startMs, endMs] contains
// the playhead. If we're between two words (mid-utterance gap), returns the
// most recently completed word so the highlight doesn't flicker off.
function findCurrentWordIdx(words: WordTiming[], currentMs: number): number | null {
  if (words.length === 0) return null;
  if (currentMs < words[0].startMs) return null;
  let lo = 0;
  let hi = words.length - 1;
  let lastBefore: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const w = words[mid];
    if (currentMs < w.startMs) {
      hi = mid - 1;
    } else if (currentMs > w.endMs) {
      lastBefore = mid;
      lo = mid + 1;
    } else {
      return mid;
    }
  }
  return lastBefore;
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
  const [done, setDone] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(2);

  // Keep ref in sync for use inside callbacks
  useEffect(() => { selectedBadgeRef.current = selectedBadge; }, [selectedBadge]);

  const activeScript = selectedBadge === 2 ? storyScript : FACET_SCRIPTS[selectedBadge];
  const hasPlayableContent = Boolean(emberId) && Boolean(activeScript ?? (selectedBadge === 2 ? storyScript : null));
  const { flatWords } = useMemo(() => tokenizeScriptToLines(activeScript), [activeScript]);
  const shouldAnimate = playbackState === 'playing' && !done;
  const isPlaying = playbackState === 'playing';

  // Karaoke state — word timings from /snapshot-audio?timings=1, and the
  // current word index updated each animation frame from audio.currentTime.
  const wordsRef = useRef<WordTiming[]>([]);
  const rafRef = useRef<number | null>(null);
  const [currentWordIdx, setCurrentWordIdx] = useState<number | null>(null);
  // Window of 3 words shown on screen at a time, sliding forward as the
  // narrator speaks. Tracked separately from currentWordIdx so the window
  // only shifts when we cross out of it (not on every word change).
  const [windowStart, setWindowStart] = useState(0);
  const WORDS_PER_WINDOW = 3;

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

  // Karaoke loop: poll the audio element each frame, find the active word,
  // and slide the 3-word window forward when the active word moves past the
  // visible group. Falls back to a fixed-interval window advance when no
  // timings are available (old cached renders, error cases).
  useEffect(() => {
    if (!shouldAnimate) return;

    const hasTimings = wordsRef.current.length > 0;
    const totalWords = flatWords.length;

    if (!hasTimings) {
      // Fallback: advance window every ~650ms.
      if (totalWords === 0) return;
      const timer = setInterval(() => {
        setWindowStart((current) => {
          const next = current + WORDS_PER_WINDOW;
          if (next >= totalWords) {
            setDone(true);
            return current;
          }
          return next;
        });
      }, 650);
      return () => clearInterval(timer);
    }

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const audio = audioRef.current;
      const words = wordsRef.current;
      if (audio && words.length > 0) {
        const currentMs = audio.currentTime * 1000;
        const idx = findCurrentWordIdx(words, currentMs);
        if (idx !== currentWordIdx) setCurrentWordIdx(idx);

        if (idx !== null) {
          // Slide the window forward when the active word reaches the last
          // visible slot. Snap to a multiple of WORDS_PER_WINDOW so groups
          // swap cleanly rather than shifting one word at a time.
          const visibleEnd = windowStart + WORDS_PER_WINDOW - 1;
          if (idx > visibleEnd) {
            const nextStart = Math.floor(idx / WORDS_PER_WINDOW) * WORDS_PER_WINDOW;
            setWindowStart(Math.max(0, Math.min(nextStart, Math.max(0, totalWords - WORDS_PER_WINDOW))));
          }
        }

        if (!audio.paused && audio.ended) {
          setDone(true);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [shouldAnimate, flatWords, currentWordIdx, windowStart]);

  const fetchAudioBlob = useCallback(async () => {
    if (!emberId) throw new Error('No ember selected.');
    const badge = selectedBadgeRef.current;
    const facetScript = FACET_SCRIPTS[badge];

    if (facetScript) {
      const facetUrl = guestToken
        ? `/api/embers/${emberId}/snapshot-audio?token=${encodeURIComponent(guestToken)}`
        : `/api/embers/${emberId}/snapshot-audio`;
      const response = await fetch(facetUrl, {
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

  // Second request to the same render URL with `?timings=1` — returns the
  // cached word-timing JSON instead of audio bytes. Best-effort: returns []
  // if the renderer didn't (or couldn't) write a sidecar, in which case the
  // overlay falls back to the timer-based line cascade.
  const fetchTimings = useCallback(async (): Promise<WordTiming[]> => {
    if (!emberId) return [];
    const badge = selectedBadgeRef.current;
    const facetScript = FACET_SCRIPTS[badge];
    try {
      if (facetScript) {
        const url = guestToken
          ? `/api/embers/${emberId}/snapshot-audio?timings=1&token=${encodeURIComponent(guestToken)}`
          : `/api/embers/${emberId}/snapshot-audio?timings=1`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script: facetScript }),
        });
        if (!res.ok) return [];
        const json = (await res.json().catch(() => null)) as { words?: WordTiming[] } | null;
        return Array.isArray(json?.words) ? json.words : [];
      }
      const url = guestToken
        ? `/api/embers/${emberId}/snapshot-audio?timings=1&token=${encodeURIComponent(guestToken)}`
        : `/api/embers/${emberId}/snapshot-audio?timings=1`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return [];
      const json = (await res.json().catch(() => null)) as { words?: WordTiming[] } | null;
      return Array.isArray(json?.words) ? json.words : [];
    } catch {
      return [];
    }
  }, [emberId, guestToken]);

  const buildAudio = useCallback(async () => {
    const audioBlob = await fetchAudioBlob();
    // Kick off the timings fetch in parallel — the audio render is already
    // cached by the time the audio blob arrives, so the sidecar JSON is just
    // a quick file read on the server.
    void fetchTimings().then((words) => {
      wordsRef.current = words;
    });
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
  }, [fetchAudioBlob, fetchTimings]);

  const startPlayback = useCallback(
    async ({ restart = false }: { restart?: boolean } = {}) => {
      if (!emberId || !hasPlayableContent) return;
      setError('');
      setPlaybackState('loading');
      try {
        const audio = audioRef.current || (await buildAudio());
        if (restart) {
          resetAudioPosition(audio);
          setWindowStart(0);
          setDone(false);
          setCurrentWordIdx(null);
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
    wordsRef.current = [];
    setPlaybackState('idle');
    setWindowStart(0);
    setDone(false);
    setError('');
    setCurrentWordIdx(null);
    setSelectedBadge(i);
  }, [disposeAudio]);

  return (
    <>
      <Link href={closeHref} className="fixed inset-0" style={{ zIndex: 29 }} aria-label="Close" />
      <div className="absolute left-0 right-0 z-30 flex flex-col items-center px-4 gap-3" style={{ bottom: 24 }}>

        <div className="w-full max-w-md text-center px-2" style={{ minHeight: '3.2rem' }}>
          {(() => {
            // Visible 3-word window. While playing we slide the window to keep
            // the current word inside it (see karaoke loop above). Idle/preview
            // shows the first three words so the area isn't blank.
            const start = Math.max(
              0,
              Math.min(windowStart, Math.max(0, flatWords.length - WORDS_PER_WINDOW)),
            );
            const visible = flatWords.slice(start, start + WORDS_PER_WINDOW);
            const visibleArea = isPlaying;
            return (
              <p
                className="font-semibold leading-snug w-full flex justify-center items-baseline gap-3"
                style={{
                  fontSize: 'clamp(1.6rem, 5vw, 2.2rem)',
                  color: visibleArea ? '#ffffff' : 'transparent',
                  textShadow: visibleArea ? '0 1px 8px rgba(0,0,0,0.9)' : 'none',
                  transition: 'color 0.4s ease',
                }}
              >
                {visible.map((w) => {
                  const isCurrent = currentWordIdx !== null && w.globalIdx === currentWordIdx;
                  const isPast = currentWordIdx !== null && w.globalIdx < currentWordIdx;
                  const base = w.quoted ? QUOTE_COLOR : NARRATION_COLOR;
                  return (
                    <span
                      key={w.globalIdx}
                      style={{
                        color: visibleArea ? base : 'transparent',
                        opacity: !visibleArea ? 1 : isCurrent ? 1 : isPast ? 0.55 : 0.35,
                        transform: isCurrent ? 'scale(1.18)' : 'scale(1)',
                        fontWeight: isCurrent ? 800 : 600,
                        transition:
                          'opacity 0.18s ease, transform 0.18s ease, font-weight 0.1s linear, color 0.4s ease',
                        display: 'inline-block',
                      }}
                    >
                      {w.text}
                    </span>
                  );
                })}
              </p>
            );
          })()}
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
