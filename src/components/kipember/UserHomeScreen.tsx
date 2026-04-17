'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function SvgItem({
  label,
  href,
  onClick,
  children,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const inner = (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
      <span className="text-xs text-center leading-tight">{label}</span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="svg-item">
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="svg-item" style={{ cursor: 'pointer' }}>
      {inner}
    </button>
  );
}

export default function UserHomeScreen({
  initialProfile,
}: {
  initialProfile: { name: string | null; email: string } | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [storedTheme, setStoredTheme] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('ember-theme');
    if (stored) {
      setStoredTheme(stored);
      document.documentElement.dataset.theme = stored;
    }
  }, []);

  useEffect(() => {
    const theme = params.get('theme');
    if (!theme) return;
    localStorage.setItem('ember-theme', theme);
    document.documentElement.dataset.theme = theme;
    setStoredTheme(theme);
  }, [params]);

  const isDarkTheme = params.get('theme') ? params.get('theme') !== 'light' : storedTheme !== 'light';
  const themeHref = isDarkTheme ? '/home?theme=light' : '/home?theme=dark';

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/signin');
    router.refresh();
  }

  const displayName = initialProfile?.name || initialProfile?.email || 'Ember User';

  return (
    <div
      className="flex min-h-[100dvh] w-full items-center justify-center px-4"
      style={{ background: '#000' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-modal)',
          WebkitBackdropFilter: 'blur(5px)',
          backdropFilter: 'blur(5px)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex flex-col items-center pt-6 pb-4 gap-2">
          <div
            className="rounded-full flex items-center justify-center"
            style={{ width: 66, height: 66, background: 'rgba(249,115,22,0.85)' }}
          >
            <span className="text-white text-base font-medium">{initials(displayName)}</span>
          </div>
          <span className="text-white text-base font-medium">{displayName}</span>
        </div>

        <div className="mx-5" style={{ borderTop: '1px solid var(--border-default)' }} />

        <div className="px-5 py-6 grid grid-cols-3" style={{ gap: '36px 8px' }}>
          <SvgItem label="My Embers" href="/user/my-embers">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </SvgItem>
          <SvgItem label="Shared Embers" href="/user/shared-embers">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </SvgItem>
          <SvgItem label="Create Ember" href="/home?mode=first-ember">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </SvgItem>
          <SvgItem label="Profile" href="/user/profile">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </SvgItem>
          <SvgItem label={isDarkTheme ? 'Light Mode' : 'Dark Mode'} href={themeHref}>
            {isDarkTheme ? (
              <>
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="2" x2="12" y2="4" />
                <line x1="12" y1="20" x2="12" y2="22" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="2" y1="12" x2="4" y2="12" />
                <line x1="20" y1="12" x2="22" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </>
            ) : (
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            )}
          </SvgItem>
          <SvgItem label="Logout" onClick={handleLogout}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </SvgItem>
        </div>
      </div>
    </div>
  );
}
