'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

type EmberMobileTopBarProps = {
  homeHref: string;
  embersHref: string;
  addHref: string;
  accountHref: string;
};

function GridDotsIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="8" cy="8" r="2.15" />
      <circle cx="16" cy="8" r="2.15" />
      <circle cx="8" cy="16" r="2.15" />
      <circle cx="16" cy="16" r="2.15" />
    </svg>
  );
}

function PlusIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function PersonIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 12.25a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
      <path d="M5 19.25c1.35-2.8 3.78-4.25 7-4.25s5.65 1.45 7 4.25" />
    </svg>
  );
}

const iconButtonClass =
  'inline-flex h-11 w-11 items-center justify-center rounded-full text-white/92';

export default function EmberMobileTopBar({
  homeHref,
  embersHref,
  addHref,
  accountHref,
}: EmberMobileTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();

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
    <div className="flex items-center justify-between bg-[var(--ember-charcoal)] px-3 py-2 text-white shadow-[0_10px_24px_rgba(17,17,17,0.16)] sm:hidden">
      <div className="flex items-center gap-1.5">
        <Link
          href={homeHref}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[0.9rem]"
          aria-label="Ember home"
        >
          <Image src="/emberfav.svg" alt="" width={24} height={24} priority />
        </Link>

        <Link href={embersHref} className={iconButtonClass} aria-label="Your Embers">
          <GridDotsIcon />
        </Link>

        <button
          type="button"
          onClick={handleAddClick}
          className={iconButtonClass}
          aria-label="Add Ember"
        >
          <PlusIcon />
        </button>
      </div>

      <Link href={accountHref} className={iconButtonClass} aria-label="Account">
        <PersonIcon />
      </Link>
    </div>
  );
}
