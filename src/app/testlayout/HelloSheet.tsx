'use client';

import { useEffect, useState } from 'react';
import { Check, Hand } from 'lucide-react';

const SHEET_H = '50vh';
const SNAP_MS = 320;

export default function HelloSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [showing, setShowing] = useState(isOpen);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { if (isOpen) setShowing(true); else setShowing(false); }, [isOpen]);

  function handleClose() {
    setShowing(false);
    setTimeout(onClose, SNAP_MS);
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-10 flex flex-col"
      style={{
        height: SHEET_H,
        background: '#111113',
        borderRadius: '20px 20px 0 0',
        transform: showing ? 'translateY(0)' : 'translateY(100%)',
        transition: `transform ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      <div className="flex justify-center pt-3 pb-1 flex-shrink-0" onClick={handleClose} style={{ cursor: 'pointer' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
      </div>

      <div className="flex flex-col items-center pt-2 pb-4 gap-2">
        <span className="text-white text-base font-medium">Hello there!</span>
        <p className="text-white/60 text-sm text-center px-6 pb-2">
          This is your ember. Tend it, share it, and invite contributors to help bring the memory to life.
        </p>
      </div>

      <div className="px-5">
        <button
          type="button"
          onClick={() => setDismissed((d) => !d)}
          className="flex items-center justify-center gap-2 w-full cursor-pointer"
          style={{ padding: '6px 0' }}
        >
          <div style={{
            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
            border: `1px solid ${dismissed ? '#f97316' : 'rgba(255,255,255,0.25)'}`,
            background: dismissed ? '#f97316' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {dismissed ? <Check size={10} color="#fff" strokeWidth={3} /> : null}
          </div>
          <span className="text-white/40 text-xs">Don't show again</span>
        </button>
      </div>
    </div>
  );
}
