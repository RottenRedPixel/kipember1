'use client';

import Link from 'next/link';
import { LayoutGrid, Plus, User } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import HeaderMenu from '@/components/HeaderMenu';

type EmberMobileTopBarProps = {
  homeHref: string;
  embersHref: string;
  addHref: string;
  accountHref: string;
  menuAuthMode?: 'signed-in' | 'signed-out' | 'detect';
  variant?: 'auto' | 'text' | 'icons';
};

function EmberSparkIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="2.1" />
      <path d="M12 2.5c.5 0 .9.4.9.9v3.05a.9.9 0 0 1-1.8 0V3.4c0-.5.4-.9.9-.9Z" />
      <path d="M12 17.55c.5 0 .9.4.9.9v3.05a.9.9 0 0 1-1.8 0V18.45c0-.5.4-.9.9-.9Z" />
      <path d="M2.5 12c0-.5.4-.9.9-.9h3.05a.9.9 0 0 1 0 1.8H3.4a.9.9 0 0 1-.9-.9Z" />
      <path d="M17.55 12c0-.5.4-.9.9-.9h3.05a.9.9 0 0 1 0 1.8H18.45a.9.9 0 0 1-.9-.9Z" />
      <path d="M5.37 5.37a.9.9 0 0 1 1.27 0L8.8 7.53a.9.9 0 1 1-1.27 1.27L5.37 6.64a.9.9 0 0 1 0-1.27Z" />
      <path d="M15.2 15.2a.9.9 0 0 1 1.27 0l2.16 2.16a.9.9 0 1 1-1.27 1.27L15.2 16.47a.9.9 0 0 1 0-1.27Z" />
      <path d="M18.63 5.37a.9.9 0 0 1 0 1.27L16.47 8.8A.9.9 0 1 1 15.2 7.53l2.16-2.16a.9.9 0 0 1 1.27 0Z" />
      <path d="M8.8 15.2a.9.9 0 0 1 0 1.27l-2.16 2.16a.9.9 0 1 1-1.27-1.27l2.16-2.16a.9.9 0 0 1 1.27 0Z" />
    </svg>
  );
}

const iconButtonClass =
  'inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/5 text-white/92 backdrop-blur-md';

export default function EmberMobileTopBar({
  homeHref,
  embersHref,
  addHref,
  accountHref,
  menuAuthMode = 'detect',
  variant = 'auto',
}: EmberMobileTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const pathSegments = pathname?.split('/').filter(Boolean) ?? [];
  const isImageRoute = pathSegments[0] === 'image';
  const isImagePage = isImageRoute && pathSegments.length === 2;

  if (isImagePage) {
    return null;
  }

  const useTextHeader =
    variant === 'text' ||
    (variant === 'auto' && (pathname === '/create' || pathname === '/feed' || isImageRoute));

  if (useTextHeader) {
    const homeActive = pathname === '/create';
    const embersActive = pathname === '/feed' || isImageRoute;

    return (
      <div className="flex h-[2.7rem] w-full items-center justify-between px-4 text-[0.78rem] font-semibold tracking-[0.16em] text-white">
        <div className="flex items-center gap-4">
          <Link href={homeHref} className={homeActive ? 'text-white' : 'text-white/45'}>
            HOME
          </Link>
          <Link href={embersHref} className={embersActive ? 'text-white' : 'text-white/45'}>
            EMBERS
          </Link>
        </div>

        <HeaderMenu authMode={menuAuthMode} className="text-white/55 hover:text-white" />
      </div>
    );
  }

  const handleAddClick = () => {
    const targetUrl = new URL(addHref, 'http://ember.local');
    const shouldOpenInline =
      pathname === targetUrl.pathname &&
      (targetUrl.searchParams.get('openUploader') === '1' ||
        targetUrl.searchParams.get('openGuestUploader') === '1');

    if (shouldOpenInline) {
      window.dispatchEvent(new Event('ember:open-upload-picker'));
      return;
    }

    router.push(addHref);
  };

  return (
    <div>
      <div className="flex h-[3.65rem] w-full items-center justify-between px-3 py-2 text-white">
        <div className="flex items-center gap-2">
        <Link
          href={homeHref}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/5 text-[var(--ember-orange)] backdrop-blur-md"
          aria-label="Ember home"
        >
          <EmberSparkIcon className="h-[1.18rem] w-[1.18rem]" />
        </Link>

        <Link href={embersHref} className={iconButtonClass} aria-label="Your Embers">
          <LayoutGrid className="h-[0.98rem] w-[0.98rem]" />
        </Link>

        <button
          type="button"
          onClick={handleAddClick}
          className={iconButtonClass}
          aria-label="Add Ember"
        >
          <Plus className="h-[1rem] w-[1rem]" />
        </button>
        </div>

        <Link href={accountHref} className={iconButtonClass} aria-label="Account">
          <User className="h-[0.96rem] w-[0.96rem]" />
        </Link>
      </div>
    </div>
  );
}
