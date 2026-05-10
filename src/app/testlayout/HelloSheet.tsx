'use client';

import { useState } from 'react';
import { Check, Hand, X } from 'lucide-react';

const SHEET_H = '50vh';
const SNAP_MS = 320;

export default function HelloSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-10 flex flex-col"
      style={{
        height: SHEET_H,
        background: '#111113',
        borderRadius: '20px 20px 0 0',
        transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: `transform ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      <div className="flex justify-end px-4 pt-4">
        <button className="cursor-pointer" onClick={onClose}>
          <X size={20} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
        </button>
      </div>

      <div className="flex flex-col items-center pt-2 pb-4 gap-2">
        <div className="rounded-full flex items-center justify-center" style={{ width: 55, height: 55, background: '#f97316' }}>
          <Hand size={28} color="#fff" strokeWidth={1.6} />
        </div>
        <span className="text-white text-base font-medium">Hello there!</span>
        <p className="text-white/60 text-sm text-center px-6 pb-2">
          This is your ember. Tend it, share it, and invite contributors to help bring the memory to life.
        </p>
      </div>

      <div className="mx-5" style={{ borderTop: '1px solid var(--border-default)' }} />

      <div className="px-5 pt-3 pb-4">
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
