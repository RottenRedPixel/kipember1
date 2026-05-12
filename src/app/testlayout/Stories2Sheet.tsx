'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Available (kept for reuse):
// import { Heart, MapPinned, ScanEye, Smile, Users } from 'lucide-react';
// import MicLevelMeter from '@/components/kipember/workflows/MicLevelMeter';
//
// BADGES — 5 facet buttons with active/vizColor per badge
// FACET_SCRIPTS — placeholder scripts for each non-snapshot badge
// buildStoryLines() — splits a script string into ≤6 display chunks (≤40 chars each)
// PlaybackState — 'idle' | 'loading' | 'playing' | 'paused'
// disposeAudio() — tears down HTMLAudioElement + AudioContext + analyser
// fetchAudioBlob() — GET /snapshot-audio (published) or POST (facet script)
// buildAudio() — fetches blob → HTMLAudioElement + AudioContext + AnalyserNode
// startPlayback({ restart? }) — loads audio if needed, calls audio.play()
// handleToggle() — pause if playing, else startPlayback
// switchBadge(i) — dispose + reset state + change selected badge
// lineIndex / fading / done — advancing text animation state
// analyserRef — live AnalyserNode for MicLevelMeter visualizer

const SHEET_H = '30vh';
const SNAP_MS = 320;

const DUMMY_AVATARS_LEFT = [
  { id: 1, initials: 'AB', color: '#f97316' },
  { id: 2, initials: 'LM', color: '#60a5fa' },
  { id: 3, initials: 'ZK', color: '#86efac' },
  { id: 4, initials: 'SR', color: '#f472b6' },
  { id: 5, initials: 'TN', color: '#fde047' },
  { id: 6, initials: 'DJ', color: '#c084fc' },
];

const DUMMY_AVATARS_RIGHT = [
  { id: 7,  initials: 'PK', color: '#34d399' },
  { id: 8,  initials: 'MR', color: '#fb923c' },
  { id: 9,  initials: 'CL', color: '#a78bfa' },
  { id: 10, initials: 'NW', color: '#f87171' },
];

const AVATAR_SIZE = 36;
const OVERLAP = 10;
const STEP = AVATAR_SIZE - OVERLAP;

// Drag-to-reorder avatar stack.
// reverseDepth: false (default) → rightmost avatar on top (use for left group, closest-to-center is rightmost)
//               true             → leftmost avatar on top  (use for right group, closest-to-center is leftmost)
function AvatarStack({ avatars, onAvatarClick, reverseDepth = false, onDropOnPlay, activatedIds = new Set<number>() }: { avatars: typeof DUMMY_AVATARS_LEFT; onAvatarClick: (id: number) => void; reverseDepth?: boolean; onDropOnPlay?: (id: number) => void; activatedIds?: Set<number> }) {
  const [order, setOrder] = useState(avatars.map((a) => a.id));
  const [draggingId, setDraggingId] = useState<number | null>(null);

  // Keep order in sync if avatars list changes (e.g. slice size changes)
  useEffect(() => { setOrder(avatars.map((a) => a.id)); }, [avatars.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [dragX, setDragX] = useState(0);
  const dragStart = useRef<{ x: number; id: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent, id: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, id };
    setDraggingId(id);
    setDragX(0);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    setDragX(e.clientX - dragStart.current.x);
  }, []);

  const commitDrag = useCallback((droppedOnPlay = false) => {
    if (!dragStart.current) return;
    const movedId = dragStart.current.id;
    if (droppedOnPlay && onDropOnPlay) {
      onDropOnPlay(movedId);
    } else {
      const slots = Math.round(dragX / STEP);
      if (slots !== 0) {
        setOrder((prev) => {
          const idx = prev.indexOf(movedId);
          const next = [...prev];
          next.splice(idx, 1);
          const target = Math.max(0, Math.min(next.length, idx + slots));
          next.splice(target, 0, movedId);
          return next;
        });
      }
    }
    dragStart.current = null;
    setDraggingId(null);
    setDragX(0);
  }, [dragX, onDropOnPlay]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const hits = document.elementsFromPoint(e.clientX, e.clientY);
    const onPlay = hits.some((el) => (el as HTMLElement).dataset?.playButton === '1');
    commitDrag(onPlay);
  }, [commitDrag]);

  const handlePointerCancel = useCallback(() => { commitDrag(false); }, [commitDrag]);

  const avatarMap = Object.fromEntries(avatars.map((a) => [a.id, a]));
  const totalWidth = AVATAR_SIZE + (order.length - 1) * STEP;

  return (
    <div style={{ position: 'relative', width: totalWidth, height: AVATAR_SIZE, flexShrink: 0 }}>
      {order.map((id, i) => {
        const avatar = avatarMap[id];
        const isDragging = draggingId === id;
        const baseX = i * STEP;
        const x = isDragging ? baseX + dragX : baseX;
        return (
          <div
            key={id}
            onPointerDown={(e) => handlePointerDown(e, id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onClick={() => !dragX && onAvatarClick(id)}
            style={{
              position: 'absolute',
              left: x,
              top: 0,
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: '50%',
              background: activatedIds.has(id) ? avatar.color : '#3a3a3a',
              border: '2px solid #1f1f1f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: activatedIds.has(id) ? '#000' : 'rgba(255,255,255,0.35)',
              transition: isDragging ? 'none' : 'left 150ms ease, background 300ms ease, color 300ms ease',
              cursor: isDragging ? 'grabbing' : 'grab',
              zIndex: isDragging ? 10 : (reverseDepth ? order.length - 1 - i : i),
              userSelect: 'none',
              touchAction: 'none',
              boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.4)' : 'none',
            }}
          >
            {avatar.initials}
          </div>
        );
      })}
    </div>
  );
}

export default function Stories2Sheet({
  isOpen,
  onClose,
  emberId,
  storyScript,
}: {
  isOpen: boolean;
  onClose: () => void;
  emberId: string | null;
  storyScript: string | null;
}) {
  const [showing, setShowing] = useState(isOpen);

  useEffect(() => {
    if (isOpen) { setShowing(true); }
    else { setShowing(false); }
  }, [isOpen]);

  function handleClose() {
    setShowing(false);
    setTimeout(onClose, SNAP_MS);
  }

  const pullDragRef = useRef<number | null>(null);

  // Ripple + color reveal on avatar-drop-to-play
  const [rippleKey, setRippleKey] = useState(0);
  const [rippling, setRippling] = useState(false);
  const [activatedIds, setActivatedIds] = useState<Set<number>>(new Set());

  const handleDropOnPlay = useCallback((id: number) => {
    setActivatedIds((prev) => new Set([...prev, id]));
    setRippleKey((k) => k + 1);
    setRippling(true);
    setTimeout(() => setRippling(false), 700);
  }, []);

  void emberId; void storyScript;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-10 flex flex-col"
      style={{
        height: SHEET_H,
        background: '#1f1f1f',
        borderRadius: '20px 20px 0 0',
        transform: showing ? 'translateY(0)' : 'translateY(100%)',
        transition: `transform ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      {/* Pull bar */}
      <div
        className="flex justify-center pt-3 pb-2 flex-shrink-0"
        style={{ cursor: 'pointer' }}
        onPointerDown={(e) => { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); pullDragRef.current = e.clientY; }}
        onPointerUp={(e) => { if (pullDragRef.current === null) return; const dy = e.clientY - pullDragRef.current; pullDragRef.current = null; if (dy < 10) handleClose(); else if (dy > 40) handleClose(); }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
      </div>

      {/* content goes here */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Avatars — left (rightmost = closest to center = on top) */}
        <div className="absolute" style={{ right: 'calc(50% + 44px)' }}>
          <AvatarStack avatars={DUMMY_AVATARS_LEFT.slice(0, 4)} onAvatarClick={(id) => console.log('left avatar clicked', id)} onDropOnPlay={handleDropOnPlay} activatedIds={activatedIds} />
        </div>
        {/* Avatars — right (leftmost = closest to center = on top) */}
        <div className="absolute" style={{ left: 'calc(50% + 44px)' }}>
          <AvatarStack avatars={DUMMY_AVATARS_RIGHT} onAvatarClick={(id) => console.log('right avatar clicked', id)} reverseDepth onDropOnPlay={handleDropOnPlay} activatedIds={activatedIds} />
        </div>
        {/* Play button — ripple wrapper keeps button centered */}
        <div style={{ position: 'relative', flexShrink: 0, width: 48, height: 48 }}>
          {rippling && (
            <div key={rippleKey} style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.55)',
              animation: 'playRipple 700ms ease-out forwards',
              pointerEvents: 'none',
            }} />
          )}
          <button
            type="button"
            data-play-button="1"
            className="flex items-center justify-center rounded-full cursor-pointer"
            style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)' }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="white">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes playRipple {
          from { transform: scale(1);   opacity: 0.55; }
          to   { transform: scale(2.8); opacity: 0;    }
        }
      `}</style>

    </div>
  );
}
