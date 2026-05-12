'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type AppHeaderProps = {
  avatarUrl?: string | null;
  userInitials?: string;
  userModalHref?: string;
  hasPassword?: boolean;
};

function computeInitials(value: string): string {
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

export default function AppHeader({
  avatarUrl: externalAvatarUrl,
  userInitials = 'ST',
  userModalHref = '/account',
  hasPassword: externalHasPassword,
}: AppHeaderProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(externalAvatarUrl ?? null);
  const [authenticated, setAuthenticated] = useState(externalAvatarUrl !== undefined);
  const [hasPassword, setHasPassword] = useState<boolean>(externalHasPassword ?? true);
  const [localInitials, setLocalInitials] = useState<string>(userInitials);
  // When the caller doesn't pass auth state we self-fetch. Hide the right
  // side until the fetch resolves so it never flashes "login" mid-transition.
  const [authLoading, setAuthLoading] = useState(externalAvatarUrl === undefined);
  const pathname = usePathname();
  const isHomeDashboard = pathname === '/home';
  const isEmbersList = pathname === '/embers';

  useEffect(() => {
    // Caller is managing auth state — use what was passed
    if (externalAvatarUrl !== undefined) {
      setAvatarUrl(externalAvatarUrl);
      setAuthenticated(true);
      setAuthLoading(false);
      if (externalHasPassword !== undefined) setHasPassword(externalHasPassword);
      return;
    }

    // Self-fetch: determine auth state, load avatar, and compute initials
    // from the profile. Without this last step, pages that don't pass
    // userInitials (e.g. the landing page rendering <AppHeader />) fell
    // back to the literal "ST" default even when a real user was signed in.
    void fetch('/api/profile', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          setAuthenticated(false);
          setAuthLoading(false);
          return;
        }
        setAuthenticated(true);
        const payload = await res.json();
        const user = payload?.user;
        if (typeof user?.avatarUrl === 'string') {
          setAvatarUrl(user.avatarUrl);
        }
        setHasPassword(user?.hasPassword === true);
        const display =
          [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
          (typeof user?.email === 'string' ? user.email : '');
        if (display) {
          setLocalInitials(computeInitials(display));
        }
        setAuthLoading(false);
      })
      .catch(() => {
        setAuthenticated(false);
        setAuthLoading(false);
      });
  }, [externalAvatarUrl]);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-30 flex items-center px-4 gap-2"
      style={{
        height: 56,
        background: 'var(--bg-chrome)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center flex-shrink-0">
        <svg width={22} height={22} viewBox="0 0 72 72" fill="white">
          <circle cx="36" cy="36" r="7.2" fill="#f97316" />
          <rect x="32.4" y="3.18" width="7.2" height="21.6" rx="3.6" ry="3.6" />
          <rect x="32.4" y="47.22" width="7.2" height="21.6" rx="3.6" ry="3.6" />
          <rect x="10.38" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-22.02 49.98) rotate(-90)" />
          <rect x="54.42" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(22.02 94.02) rotate(-90)" />
          <rect x="47.97" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(29.55 -30.48) rotate(45)" />
          <rect x="16.83" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(42.45 .66) rotate(45)" />
          <rect x="16.83" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-8.46 20.43) rotate(-45)" />
          <rect x="47.97" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-21.36 51.57) rotate(-45)" />
        </svg>
      </Link>

      {/* Nav links */}
      <Link href="/about" className="px-1 py-3 text-sm nav-link flex-shrink-0" style={{ color: pathname === '/about' ? '#ffffff' : '#6b7280' }}>
        about
      </Link>
      {!authLoading && authenticated && hasPassword && (
        <>
          <Link href="/home" className="px-1 py-3 text-sm nav-link flex-shrink-0" style={{ color: isHomeDashboard ? '#ffffff' : '#6b7280' }}>
            home
          </Link>
          <Link href="/embers" className="px-1 py-3 text-sm nav-link flex-shrink-0" style={{ color: isEmbersList ? '#ffffff' : '#6b7280' }}>
            embers
          </Link>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side — avatar for full accounts, create account for passwordless, login for guests.
          Render nothing while auth state is loading to avoid flashing "login" on page transitions. */}
      {authLoading ? null : authenticated && hasPassword ? (
        <Link
          href={userModalHref}
          className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{ width: 35, height: 35, background: 'rgba(249,115,22,0.85)' }}
          aria-label="Account"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
          ) : (
            <span className="text-white text-sm font-medium">{localInitials}</span>
          )}
        </Link>
      ) : authenticated && !hasPassword ? (
        <Link
          href="/signup"
          className="rounded-full flex items-center justify-center flex-shrink-0"
          style={{ width: 35, height: 35, background: 'rgba(249,115,22,0.85)' }}
          aria-label="Create account"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </Link>
      ) : (
        <Link
          href="/login"
          className="px-1 py-3 text-sm nav-link flex-shrink-0"
          style={{ color: pathname === '/login' ? '#ffffff' : '#6b7280' }}
        >
          login
        </Link>
      )}
    </div>
  );
}
