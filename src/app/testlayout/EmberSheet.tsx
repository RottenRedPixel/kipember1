'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCirclePlus, X } from 'lucide-react';

const SHEET_H = '50vh';
const SNAP_MS = 320;
const SWIPE_THRESHOLD = 40;

export default function EmberSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [showing, setShowing] = useState(isOpen);
  const [expanded, setExpanded] = useState(false);
  const dragRef = useRef<{ startY: number } | null>(null);

  useEffect(() => {
    if (isOpen) setShowing(true);
    else { setShowing(false); setExpanded(false); }
  }, [isOpen]);

  function handleClose() {
    setShowing(false);
    setExpanded(false);
    setTimeout(onClose, SNAP_MS);
  }

  function handlePullPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY };
  }

  function handlePullPointerUp(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dy = e.clientY - dragRef.current.startY;
    dragRef.current = null;

    if (Math.abs(dy) < 10) {
      if (expanded) setExpanded(false);
      else handleClose();
    } else if (!expanded && dy < -SWIPE_THRESHOLD) {
      setExpanded(true);
    } else if (expanded && dy > SWIPE_THRESHOLD) {
      setExpanded(false);
    }
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex flex-col"
      style={{
        height: expanded ? '100dvh' : SHEET_H,
        zIndex: expanded ? 50 : 10,
        background: '#111113',
        borderRadius: '20px 20px 0 0',
        transform: showing ? 'translateY(0)' : 'translateY(100%)',
        transition: `transform ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1), height ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      {expanded ? (
        <div className="flex items-center px-4 pt-4 pb-3 flex-shrink-0">
          <MessageCirclePlus size={18} color="white" strokeWidth={1.8} />
          <span className="flex-1 ml-2 text-white font-semibold text-base">Ember</span>
          <button className="cursor-pointer" onClick={handleClose}>
            <X size={20} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
          </button>
        </div>
      ) : (
        <>
          <div
            className="flex justify-center pt-3 pb-1 flex-shrink-0"
            style={{ cursor: 'pointer' }}
            onPointerDown={handlePullPointerDown}
            onPointerUp={handlePullPointerUp}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
          </div>
          <div className="flex items-center px-4 pt-2 pb-3 flex-shrink-0">
            <MessageCirclePlus size={18} color="white" strokeWidth={1.8} />
            <span className="flex-1 ml-2 text-white font-semibold text-base">Ember</span>
          </div>
        </>
      )}
    </div>
  );
}
