'use client';

import Link from 'next/link';
import { Home, UserPlus, ChevronDown, Plus, ScanEye, Share2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getEmberTitle } from '@/lib/ember-title';
import { getPreviewMediaUrl } from '@/lib/media';
import GuestContributorAddFlow from '@/components/kipember/workflows/GuestContributorAddFlow';

type GuestData = {
  guestFlow: true;
  contributor: {
    id: string;
    name: string | null;
    phoneNumber: string | null;
  };
  image: {
    id: string;
    filename: string;
    mediaType: 'IMAGE' | 'VIDEO';
    posterFilename: string | null;
    durationSeconds: number | null;
    originalName: string;
    title: string | null;
    description: string | null;
    createdAt: string;
  };
};

function EmberMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="white">
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
  );
}

function RailBtn({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.40)', WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}
      >
        <Icon size={23} color="var(--text-primary)" strokeWidth={1.8} />
      </div>
      <span className="text-white text-xs font-medium lowercase">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="flex flex-col items-center gap-1 p-2 rounded-xl">
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 p-2 rounded-xl cursor-pointer"
    >
      {inner}
    </button>
  );
}

export default function GuestEmberScreen({ token }: { token: string }) {
  const params = useSearchParams();
  const flow = params.get('ember');

  const [data, setData] = useState<GuestData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/guest/${token}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load this memory');
      const payload = (await response.json()) as GuestData;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this memory');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--bg-screen)' }}>
        <p className="text-white/60 text-sm">Loading memory...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg-screen)' }}>
        <p className="text-white font-medium text-base mb-2">Memory not found</p>
        <p className="text-white/60 text-sm text-center mb-6">{error || 'This memory is no longer available.'}</p>
        <Link
          href="/"
          className="px-8 rounded-full text-white text-sm font-medium"
          style={{ background: '#f97316', minHeight: 44, display: 'flex', alignItems: 'center' }}
        >
          Back to Ember
        </Link>
      </div>
    );
  }

  const title = getEmberTitle({ title: data.image.title, originalName: data.image.originalName });
  const photoUrl = getPreviewMediaUrl({
    mediaType: data.image.mediaType,
    filename: data.image.filename,
    posterFilename: data.image.posterFilename,
  });

  const guestUrl = typeof window !== 'undefined' ? window.location.href : '';
  const openHref = `/guest/${token}?ember=contrib-add`;
  const closeHref = `/guest/${token}`;

  return (
    <div className="fixed inset-0" style={{ background: 'var(--bg-screen)' }}>
      {/* Background image */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${photoUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(24px)',
          transform: 'scale(1.08)',
          opacity: 0.7,
        }}
      />
      <img
        src={photoUrl}
        alt=""
        className="absolute left-0 right-0 pointer-events-none w-full"
        style={{
          top: 72,
          bottom: 72,
          height: 'calc(100% - 144px)',
          objectFit: 'cover',
          objectPosition: 'center center',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.55) 100%)' }}
      />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 pt-4 pb-4">
        <Link
          href="/"
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--bg-rail-btn)', WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}
        >
          <Home size={20} color="var(--text-primary)" strokeWidth={1.8} />
        </Link>
        <div className="pointer-events-none flex-1">
          <p className="text-white font-medium text-base leading-tight">{title}</p>
        </div>
        <Link
          href="/signup"
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(249,115,22,0.85)' }}
        >
          <UserPlus size={20} color="white" strokeWidth={1.8} />
        </Link>
      </div>

      {/* Right rail */}
      <div className="absolute right-0 z-20 flex flex-col items-center gap-1 pr-1" style={{ top: '50%', transform: 'translateY(-50%)' }}>
        <RailBtn icon={ScanEye} label="play" href={`/guest/${token}?m=play`} />
        <RailBtn
          icon={Share2}
          label="share"
          onClick={() => {
            const url = guestUrl || window.location.href;
            if (navigator.share) {
              void navigator.share({ title, url });
            } else {
              void navigator.clipboard.writeText(url);
            }
          }}
        />
      </div>

      {/* Ember Chat bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30 flex flex-col"
        style={{ background: 'var(--bg-screen)', borderTop: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3 pl-4 pr-[22px] py-3">
          <Link
            href={flow ? closeHref : openHref}
            className="flex-1 text-left"
          >
            <span className="flex items-center gap-2">
              <EmberMark />
              <span className="text-base font-medium text-white">
                {flow ? 'Ember Chat' : 'Ember interactive memory'}
              </span>
            </span>
          </Link>
          <Link
            href={flow ? closeHref : openHref}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ background: flow ? 'rgba(255,255,255,0.15)' : '#f97316' }}
          >
            {flow ? (
              <ChevronDown size={18} color="var(--text-primary)" strokeWidth={1.8} />
            ) : (
              <Plus size={20} color="white" strokeWidth={2} />
            )}
          </Link>
        </div>
        {flow ? <GuestContributorAddFlow token={token} /> : null}
      </div>
    </div>
  );
}
