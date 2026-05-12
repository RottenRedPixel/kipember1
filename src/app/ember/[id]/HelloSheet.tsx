'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Hand } from 'lucide-react';

const SNAP_MS = 320;

// When `guest` is provided the component skips the /api/profile fetch and
// uses the caller-supplied values instead (guest/contributor flows don't
// have a logged-in session).
type GuestProps = {
  firstName: string | null;
  hasPassword: boolean;
  /** true = named contributor, false = anonymous viewer */
  isContributor: boolean;
  /** Used as the localStorage key so "don't show again" is scoped to this token */
  token: string;
  createAccountHref?: string;
};

export default function HelloSheet({
  isOpen,
  onClose,
  emberId,
  accessType,
  guest,
}: {
  isOpen: boolean;
  onClose: () => void;
  emberId: string | null;
  accessType: 'owner' | 'contributor' | 'network' | null;
  guest?: GuestProps;
}) {
  const [showing, setShowing] = useState(isOpen);
  const [firstName, setFirstName] = useState<string | null>(guest?.firstName ?? null);
  const [hasPassword, setHasPassword] = useState(guest?.hasPassword ?? true);
  const [helloDismissed, setHelloDismissed] = useState(false);

  useEffect(() => {
    if (guest) return; // caller manages these values
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => {
        if (d?.user?.firstName) setFirstName((d.user.firstName as string).trim() || null);
        if (typeof d?.user?.hasPassword === 'boolean') setHasPassword(d.user.hasPassword);
      })
      .catch(() => {});
  }, [guest]);

  const storageKey = guest ? `hello-dismissed-${guest.token}` : emberId ? `hello-dismissed-${emberId}` : null;

  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      setHelloDismissed(!!localStorage.getItem(storageKey));
    }
  }, [storageKey]);

  useEffect(() => { if (isOpen) setShowing(true); else setShowing(false); }, [isOpen]);

  function handleClose() {
    setShowing(false);
    setTimeout(onClose, SNAP_MS);
  }

  function toggleDismiss() {
    const next = !helloDismissed;
    setHelloDismissed(next);
    if (storageKey) {
      if (next) localStorage.setItem(storageKey, '1');
      else localStorage.removeItem(storageKey);
    }
  }

  const isContributor = guest ? guest.isContributor : accessType === 'contributor';
  const isAnonymousGuest = guest && !guest.isContributor;
  const dragRef = useRef<number | null>(null);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-10 flex flex-col"
      style={{
        height: '50vh',
        background: 'var(--bg-chrome)',
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
        <span className="text-white text-base font-medium">
          {isAnonymousGuest ? 'Welcome!' : `Hello ${firstName ?? 'there'}!`}
        </span>
        <p className="text-white/60 text-sm text-center px-6 pb-2">
          {isAnonymousGuest
            ? "You're viewing a shared memory. Explore the story, chat with Ember, and see what others have shared."
            : isContributor
            ? "You've been invited to help build this memory. Add photos, share stories, and contribute what you remember."
            : 'This is your ember. Tend it, share it, and invite contributors to help bring the memory to life.'}
        </p>
      </div>

      {isContributor && !hasPassword ? (
        <div className="px-5 pb-4">
          <Link
            href={guest?.createAccountHref ?? '/set-password'}
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
