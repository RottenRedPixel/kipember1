'use client';

import { useEffect, useState } from 'react';
import { Leaf, X } from 'lucide-react';

const SNAP_MS = 320;
const COLORS = ['#1a1a2e', '#16213e', '#0f3460', '#1b4332', '#2d1b69', '#3d0000', '#1a2a1a', '#2a1a2a'];

export default function TendSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [showing, setShowing] = useState(isOpen);

  useEffect(() => { if (isOpen) setShowing(true); else setShowing(false); }, [isOpen]);

  function handleClose() {
    setShowing(false);
    setTimeout(onClose, SNAP_MS);
  }

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-50 flex flex-col"
      style={{
        top: 0,
        background: '#111113',
        borderRadius: '20px 20px 0 0',
        transform: showing ? 'translateY(0)' : 'translateY(100%)',
        transition: `transform ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      <div className="flex items-center px-4 pt-4 pb-3 flex-shrink-0">
        <Leaf size={18} color="white" strokeWidth={1.8} />
        <span className="flex-1 ml-2 text-white font-semibold text-base">Tend this Ember</span>
        <button className="cursor-pointer" onClick={handleClose}>
          <X size={20} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 flex flex-col gap-3" style={{ scrollbarWidth: 'none' }}>
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ height: 80, background: COLORS[i % COLORS.length] }}
          >
            <span className="text-white/50 text-sm">Box {i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
