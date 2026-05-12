'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Hand } from 'lucide-react';

const SNAP_MS = 320;

export default function HelloSheet({
  isOpen,
  onClose,
  emberId,
  accessType,
}: {
  isOpen: boolean;
  onClose: () => void;
  emberId: string | null;
  accessType: 'owner' | 'contributor' | 'network' | null;
}) {
  const [showing, setShowing] = useState(isOpen);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(true);
  const [helloDismissed, setHelloDismissed] = useState(false);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => {
        if (d?.user?.firstName) setFirstName((d.user.firstName as string).trim() || null);
        if (typeof d?.user?.hasPassword === 'boolean') setHasPassword(d.user.hasPassword);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (emberId && typeof window !== 'undefined') {
      setHelloDismissed(!!localStorage.getItem(`hello-dismissed-${emberId}`));
    }
  }, [emberId]);

  useEffect(() => { if (isOpen) setShowing(true); else setShowing(false); }, [isOpen]);

  function handleClose() {
    setShowing(false);
    setTimeout(onClose, SNAP_MS);
  }

  function toggleDismiss() {
    const next = !helloDismissed;
    setHelloDismissed(next);
    if (emberId) {
      if (next) localStorage.setItem(`hello-dismissed-${emberId}`, '1');
      else localStorage.removeItem(`hello-dismissed-${emberId}`);
    }
  }

  const isContributor = accessType === 'contributor';
  const dragRef = useRef<number | null>(null);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-10 flex flex-col"
      style={{
        height: '50vh',
        background: '#111113',
        borderRadius: '20px 20px 0 0',
        transform: showing ? 'translateY(0)' : 'translateY(100%)',
        transition: `transform ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      <div
        className="flex justify-center pt-3 pb-1 flex-shrink-0"
        style={{ cursor: 'pointer' }}
        onPointerDown={(e) => { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); dragRef.current = e.clientY; }}
        onPointerUp={(e) => { if (dragRef.current === null) return; const dy = e.clientY - dragRef.current; dragRef.current = null; if (dy < 10) handleClose(); else if (dy > 40) handleClose(); }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
      </div>

      <div className="flex flex-col items-center pt-2 pb-4 gap-2">
        <div className="rounded-full flex items-center justify-center" style={{ width: 44, height: 44, background: '#f97316' }}>
          <Hand size={22} color="#fff" strokeWidth={1.6} />
        </div>
        <span className="text-white text-base font-medium">Hello {firstName ?? 'there'}!</span>
        <p className="text-white/60 text-sm text-center px-6 pb-2">
          {isContributor
            ? "You've been invited to help build this memory. Add photos, share stories, and contribute what you remember."
            : 'This is your ember. Tend it, share it, and invite contributors to help bring the memory to life.'}
        </p>
      </div>

      {isContributor && !hasPassword ? (
        <div className="px-5 pb-4">
          <Link
            href="/set-password"
            className="flex items-center justify-center rounded-full text-white text-sm font-medium w-full"
            style={{ background: '#f97316', minHeight: 44 }}
          >
            Create Account
          </Link>
        </div>
      ) : null}
    </div>
  );
}
