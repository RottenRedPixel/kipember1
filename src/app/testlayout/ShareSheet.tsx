'use client';

import { X } from 'lucide-react';

const SHEET_H = '20vh';
const SNAP_MS = 320;

export default function ShareSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
    </div>
  );
}
