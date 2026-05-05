'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import AccountScreen from '@/components/kipember/AccountScreen';
import { isAdmin } from '@/lib/admin-access';
import { getUserDisplayName } from '@/lib/user-name';

// Account overlay — same modal pattern as KipemberWikiOverlay. Renders
// inside /ember/[id]?m=account or /home?m=account as a layer over the
// underlying view (cover photo + right rail visible in the 8% peek).
// Slides in from the right on open and back out on close, matching the
// wiki overlay's animation.
type AccountUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
};

function initialsOf(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'ST'
  );
}

export default function KipemberAccountOverlay({ closeHref }: { closeHref: string }) {
  const router = useRouter();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);

  // Fetch the user's profile (now with createdAt) — populates the
  // AccountScreen's "Member since …" line and avatar.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/profile', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { user?: AccountUser };
        if (!cancelled && payload?.user) setUser(payload.user);
      })
      .catch(() => {
        // Silently keep the previous user state.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Slide-in transition on mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setOverlayOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = useCallback(() => {
    setOverlayOpen(false);
    setTimeout(() => {
      router.push(closeHref);
    }, 300);
  }, [closeHref, router]);

  const displayName = user ? getUserDisplayName(user) || user.email : '';
  const userInitials = initialsOf(displayName || 'ST');
  const canAccessAdmin = user ? isAdmin({ email: user.email }) : false;

  return (
    <div className="absolute inset-0 z-40 flex justify-center">
      <div className="relative w-full max-w-xl h-full flex">
        <button
          type="button"
          onClick={handleClose}
          className="w-[8%] h-full"
          style={{ cursor: 'pointer' }}
          aria-label="Back to ember view"
        />
        <div
          className="flex-1 h-full flex flex-col"
          style={{
            background: 'color-mix(in srgb, var(--bg-screen) 98%, transparent)',
            borderLeft: '1px solid var(--border-subtle)',
            transform: overlayOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {user ? (
            <AccountScreen
              firstName={user.firstName}
              lastName={user.lastName}
              email={user.email}
              phoneNumber={user.phoneNumber}
              avatarUrl={user.avatarUrl}
              userInitials={userInitials}
              joinedAt={user.createdAt ? new Date(user.createdAt) : null}
              canAccessAdmin={canAccessAdmin}
              embedded
              onClose={handleClose}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
