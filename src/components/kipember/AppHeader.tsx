'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

type AppHeaderProps = {
  avatarUrl?: string | null;
  userInitials?: string;
  userModalHref?: string;
};

export default function AppHeader({
  avatarUrl: externalAvatarUrl,
  userInitials = 'ST',
  userModalHref = '/account',
}: AppHeaderProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(externalAvatarUrl ?? null);
  const [authenticated, setAuthenticated] = useState(externalAvatarUrl !== undefined);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHomeDashboard = pathname === '/home' && !searchParams.get('id');

  useEffect(() => {
    // Caller is managing auth state — use what was passed
    if (externalAvatarUrl !== undefined) {
      setAvatarUrl(externalAvatarUrl);
      setAuthenticated(true);
      return;
    }

    // Self-fetch: determine auth state and load avatar
    void fetch('/api/profile', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          setAuthenticated(false);
          return;
        }
        setAuthenticated(true);
        const payload = await res.json();
        if (typeof payload?.user?.avatarUrl === 'string') {
          setAvatarUrl(payload.user.avatarUrl);
        }
      })
      .catch(() => {
        setAuthenticated(false);
      });
  }, [externalAvatarUrl]);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-30 flex items-center px-4 gap-2"
      style={{
        height: 56,
        background: 'var(--bg-screen)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center flex-shrink-0 pr-2">
        <svg width={28} height={28} viewBox="0 0 72 72" fill="white">
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
      {authenticated ? (
        <>
          <Link href="/home" className="px-2 py-3 text-xs font-medium tracking-widest nav-link flex-shrink-0" style={{ color: isHomeDashboard ? '#ffffff' : '#6b7280' }}>
            HOME
          </Link>
          <Link href="/user/my-embers" className="px-2 py-3 text-xs font-medium tracking-widest nav-link flex-shrink-0" style={{ color: pathname === '/user/my-embers' ? '#ffffff' : '#6b7280' }}>
            EMBERS
          </Link>
        </>
      ) : (
        <Link href="/about" className="px-2 py-3 text-xs font-medium tracking-widest nav-link flex-shrink-0" style={{ color: pathname === '/about' ? '#ffffff' : '#6b7280' }}>
          ABOUT
        </Link>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side — avatar when authenticated, LOGIN when not */}
      {authenticated ? (
        <Link
          href={userModalHref}
          className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{ width: 35, height: 35, background: 'rgba(249,115,22,0.85)' }}
          aria-label="Account"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
          ) : (
            <span className="text-white text-sm font-medium">{userInitials}</span>
          )}
        </Link>
      ) : (
        <Link
          href="/login"
          className="px-2 py-3 text-xs font-medium tracking-widest nav-link flex-shrink-0"
          style={{ color: pathname === '/login' ? '#ffffff' : '#6b7280' }}
        >
          LOGIN
        </Link>
      )}
    </div>
  );
}
