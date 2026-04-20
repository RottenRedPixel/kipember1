'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';

type HeaderMenuProps = {
  authMode?: 'signed-in' | 'signed-out' | 'detect';
  className?: string;
  panelClassName?: string;
  iconClassName?: string;
  logoutRedirectTo?: string;
};


export default function HeaderMenu({
  authMode = 'detect',
  className = 'text-white/72 hover:text-white',
  panelClassName = 'right-0 top-[calc(100%+0.45rem)] min-w-[9rem] rounded-[1rem] border border-white/12 bg-[#1b1b1b] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.28)]',
  iconClassName = 'h-4.5 w-4.5',
  logoutRedirectTo = '/login',
}: HeaderMenuProps) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [resolvedAuthMode, setResolvedAuthMode] = useState<'signed-in' | 'signed-out'>(
    authMode === 'signed-in' ? 'signed-in' : 'signed-out'
  );
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (authMode !== 'detect') {
      setResolvedAuthMode(authMode);
      return;
    }

    let isMounted = true;

    const detectAuth = async () => {
      try {
        const response = await fetch('/api/profile', { cache: 'no-store' });
        if (!isMounted) {
          return;
        }

        setResolvedAuthMode(response.ok ? 'signed-in' : 'signed-out');
      } catch {
        if (isMounted) {
          setResolvedAuthMode('signed-out');
        }
      }
    };

    void detectAuth();

    return () => {
      isMounted = false;
    };
  }, [authMode]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const menuItems = useMemo(() => {
    if (resolvedAuthMode === 'signed-in') {
      return [
        {
          key: 'logout',
          label: loggingOut ? 'Logging out...' : 'Logout',
          action: async () => {
            setLoggingOut(true);
            try {
              await fetch('/api/auth/logout', { method: 'POST' });
              router.push(logoutRedirectTo);
              router.refresh();
            } finally {
              setLoggingOut(false);
              setOpen(false);
            }
          },
          disabled: loggingOut,
        },
      ];
    }

    return [
      {
        key: 'signin',
        label: 'Sign In',
        href: '/login',
      },
      {
        key: 'signup',
        label: 'Sign Up',
        href: '/signup',
      },
    ];
  }, [loggingOut, logoutRedirectTo, resolvedAuthMode, router]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-9 w-9 items-center justify-center ${className}`}
        aria-label="Open menu"
        aria-expanded={open}
      >
        <Menu className={iconClassName} />
      </button>

      {open ? (
        <div className={`absolute z-[120] ${panelClassName}`}>
          {menuItems.map((item) =>
            'href' in item ? (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex min-h-[2.6rem] items-center rounded-[0.8rem] px-3 text-sm font-medium text-white/88 transition hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.key}
                type="button"
                onClick={() => void item.action()}
                disabled={item.disabled}
                className="flex min-h-[2.6rem] w-full items-center rounded-[0.8rem] px-3 text-left text-sm font-medium text-white/88 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
              >
                {item.label}
              </button>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
