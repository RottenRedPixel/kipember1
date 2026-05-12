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

// sessionStorage cache so AppHeader doesn't flash on client-side navigation.
// Each page remounts AppHeader; without a cache every transition would
// re-fetch /api/profile and briefly hide the nav while waiting.
const CACHE_KEY = 'ember-auth-header';
type AuthCache = {
  authenticated: boolean;
  hasPassword: boolean;
  avatarUrl: string | null;
  initials: string;
};
function readCache(): AuthCache | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthCache) : null;
  } catch { return null; }
}
function writeCache(data: AuthCache) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

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
  // Seed from sessionStorage cache so nav items are visible immediately on
  // page transitions (no re-fetch needed). Falls back to hidden while loading
  // on the very first visit.
  const cached = typeof window !== 'undefined' ? readCache() : null;

  const [avatarUrl, setAvatarUrl] = useState<string | null>(externalAvatarUrl ?? cached?.avatarUrl ?? null);
  const [authenticated, setAuthenticated] = useState(externalAvatarUrl !== undefined ? true : (cached?.authenticated ?? false));
  const [hasPassword, setHasPassword] = useState<boolean>(externalHasPassword ?? cached?.hasPassword ?? true);
  const [localInitials, setLocalInitials] = useState<string>(cached?.initials ?? userInitials);
  // authLoading stays true only when we have no cached state and no external
  // state — i.e. the very first page load in this session.
  const [authLoading, setAuthLoading] = useState(externalAvatarUrl === undefined && cached === null);
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

    // Self-fetch to get fresh data (and populate/update the cache).
    // If we already had cached data, authLoading is already false so the
    // nav renders immediately while this fetch runs silently in the background.
    void fetch('/api/profile', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          setAuthenticated(false);
          setAuthLoading(false);
          writeCache({ authenticated: false, hasPassword: false, avatarUrl: null, initials: 'ST' });
          return;
        }
        const payload = await res.json();
        const user = payload?.user;
        const newAvatarUrl = typeof user?.avatarUrl === 'string' ? user.avatarUrl : null;
        const newHasPassword = user?.hasPassword === true;
        const display =
          [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
          (typeof user?.email === 'string' ? user.email : '');
        const newInitials = display ? computeInitials(display) : userInitials;

        setAuthenticated(true);
        setAvatarUrl(newAvatarUrl);
        setHasPassword(newHasPassword);
        setLocalInitials(newInitials);
        setAuthLoading(false);
        writeCache({ authenticated: true, hasPassword: newHasPassword, avatarUrl: newAvatarUrl, initials: newInitials });
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
        background: 'var(--bg-screen)',
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center flex-shrink-0">
        <svg width={22} height={22} viewBox="0 0 72 72" fill="white">
          <circle cx="36" cy="36" r="7.2" style={{ fill: 'var(--color-accent)' }} />
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

      {/* Nav links — fade in as a group so first-load is a smooth reveal,
          not a pop. On subsequent page navigations the cache means authLoading
          is already false, so they render at full opacity immediately. */}
      <div
        className="flex items-center gap-2"
        style={{ opacity: authLoading ? 0 : 1, transition: 'opacity 0.25s ease' }}
      >
        <Link href="/about" className="px-1 py-3 text-sm nav-link flex-shrink-0" style={{ color: pathname === '/about' ? 'var(--text-primary)' : 'var(--color-neutral)' }}>
          about
        </Link>
        {authenticated && hasPassword && (
          <>
            <Link href="/home" className="px-1 py-3 text-sm nav-link flex-shrink-0" style={{ color: isHomeDashboard ? 'var(--text-primary)' : 'var(--color-neutral)' }}>
              home
            </Link>
            <Link href="/embers" className="px-1 py-3 text-sm nav-link flex-shrink-0" style={{ color: isEmbersList ? 'var(--text-primary)' : 'var(--color-neutral)' }}>
              embers
            </Link>
          </>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side — fade in with the same timing as nav links. */}
      <div style={{ opacity: authLoading ? 0 : 1, transition: 'opacity 0.25s ease' }}>
      {authenticated && hasPassword ? (
        <Link
          href={userModalHref}
          className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{ width: 35, height: 35, background: 'color-mix(in srgb, var(--color-accent) 85%, transparent)' }}
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
          style={{ width: 35, height: 35, background: 'color-mix(in srgb, var(--color-accent) 85%, transparent)' }}
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
          style={{ color: pathname === '/login' ? 'var(--text-primary)' : 'var(--color-neutral)' }}
        >
          login
        </Link>
      )}
      </div>
    </div>
  );
}
