'use client';

import Link from 'next/link';
import { Home, UserPlus, ChevronDown, Plus, ScanEye, Share2, Link2, MessageCircle, Mail, MoreHorizontal, X } from 'lucide-react';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getEmberTitle } from '@/lib/ember-title';
import { getPreviewMediaUrl } from '@/lib/media';
import GuestFlow from '@/components/kipember/workflows/GuestFlow';
import KipemberPlayOverlay from '@/components/kipember/KipemberPlayOverlay';

type GuestAttachment = {
  id: string;
  filename: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO';
  posterFilename: string | null;
};

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
  attachments: GuestAttachment[];
  snapshotScript: string | null;
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

function Modal({ children, closeHref }: { children: React.ReactNode; closeHref: string }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center pb-24">
      <Link href={closeHref} className="absolute inset-0" />
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-modal)',
          WebkitBackdropFilter: 'blur(5px)',
          backdropFilter: 'blur(5px)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <Link href={closeHref} className="absolute top-3 right-3 text-white/60 z-10 w-8 h-8 flex items-center justify-center">
          <X size={18} />
        </Link>
        {children}
      </div>
    </div>
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
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 p-2 rounded-xl cursor-pointer">
      {inner}
    </button>
  );
}

export default function GuestEmberScreen({ token }: { token: string }) {
  const params = useSearchParams();
  const rawFlow = params.get('ember');
  const modal = params.get('m');
  const flowOpen = rawFlow === 'guest';

  const [data, setData] = useState<GuestData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const copyShareLink = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard API unavailable; visual feedback still fires below */
    }
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  }, []);

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
      <div className="fixed inset-0 flex justify-center" style={{ background: 'var(--bg-screen)' }}>
        <div className="relative w-full max-w-xl h-full flex items-center justify-center">
          <p className="text-white/60 text-sm">Loading memory...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 flex justify-center" style={{ background: 'var(--bg-screen)' }}>
        <div className="relative w-full max-w-xl h-full flex flex-col items-center justify-center px-6">
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
      </div>
    );
  }

  const title = getEmberTitle({ title: data.image.title, originalName: data.image.originalName });
  const mainUrl = getPreviewMediaUrl({
    mediaType: data.image.mediaType,
    filename: data.image.filename,
    posterFilename: data.image.posterFilename,
  });

  const allMedia = [
    { url: mainUrl },
    ...data.attachments.map((a) => ({
      url: getPreviewMediaUrl({ mediaType: a.mediaType, filename: a.filename, posterFilename: a.posterFilename }),
    })),
  ];
  const currentPhotoUrl = allMedia[photoIndex]?.url ?? mainUrl;
  const nextPhotoUrl = allMedia.length > 1 ? allMedia[(photoIndex + 1) % allMedia.length]?.url : null;

  const base = `/guest/${token}`;
  const openHref = `${base}?ember=guest`;
  const closeHref = base;
  const shareUrl = typeof window !== 'undefined' ? window.location.origin + base : base;

  return (
    <div className="fixed inset-0 flex justify-center" style={{ background: 'var(--bg-screen)' }}>
      <div className="relative w-full max-w-xl h-full overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${currentPhotoUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(24px)',
          transform: 'scale(1.08)',
          opacity: 0.7,
        }}
      />
      {/* Photo — letterboxed inside the band between the 56px header and
          the chat bar at the bottom (~72px). Matches the owner ember view
          so the photo never spills past the chrome. */}
      <img
        src={currentPhotoUrl}
        alt=""
        className="absolute left-0 right-0 pointer-events-none w-full"
        style={{
          top: 56,
          bottom: 72,
          height: 'calc(100% - 128px)',
          objectFit: 'contain',
          objectPosition: 'center center',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.55) 100%)' }}
      />

      {/* Header — same height + chrome as the owner AppHeader so the two
          views share visual rules. */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4"
        style={{ height: 56, background: 'var(--bg-screen)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <Link
          href="/"
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--bg-rail-btn)' }}
        >
          <Home size={18} color="var(--text-primary)" strokeWidth={1.8} />
        </Link>
        <div className="pointer-events-none flex-1 min-w-0">
          <p className="text-white font-medium text-base leading-tight truncate">{title}</p>
        </div>
        <Link
          href="/signup"
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(249,115,22,0.85)' }}
        >
          <UserPlus size={18} color="white" strokeWidth={1.8} />
        </Link>
      </div>

      {/* Right rail */}
      <div className="absolute right-3 z-20 flex flex-col gap-0 items-center" style={{ bottom: '11%' }}>
        {allMedia.length > 1 && nextPhotoUrl ? (
          <button
            type="button"
            onClick={() => setPhotoIndex((i) => (i + 1) % allMedia.length)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10 active:bg-white/20 cursor-pointer"
          >
            <div className="relative w-11 h-11">
              <div className="w-11 h-11 rounded-full overflow-hidden">
                <img src={nextPhotoUrl} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1" style={{ background: '#f97316', fontSize: 10, fontWeight: 600, color: '#fff', lineHeight: 1 }}>
                {allMedia.length}
              </div>
            </div>
            <span className="text-white text-xs font-medium lowercase">more</span>
          </button>
        ) : null}
        <RailBtn icon={Share2} label="share" href={`${base}?m=share`} />
        <RailBtn icon={ScanEye} label="view" href={`${base}?m=play`} />
      </div>

      {/* Share modal */}
      {modal === 'share' ? (
        <Modal closeHref={base}>
          <div className="flex flex-col items-center pt-6 pb-4 gap-2">
            <div className="rounded-full flex items-center justify-center" style={{ width: 66, height: 66, background: 'var(--bg-surface)' }}>
              <Share2 size={28} color="var(--text-primary)" strokeWidth={1.6} />
            </div>
            <span className="text-white text-base font-medium">Share this ember</span>
          </div>
          <div className="mx-5" style={{ borderTop: '1px solid var(--border-default)' }} />
          <div className="p-5 grid grid-cols-3 gap-1">
            <button type="button" className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" onClick={() => void copyShareLink(shareUrl)}><div className="w-11 h-11 flex items-center justify-center"><Link2 size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">Copy Link</span></button>
            <button type="button" className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" onClick={() => window.location.assign(`sms:?&body=${encodeURIComponent(shareUrl)}`)}><div className="w-11 h-11 flex items-center justify-center"><MessageCircle size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">Message</span></button>
            <a href={`mailto:?body=${encodeURIComponent(shareUrl)}`} className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover"><div className="w-11 h-11 flex items-center justify-center"><Mail size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">Email</span></a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" target="_blank" rel="noreferrer"><div className="w-11 h-11 flex items-center justify-center"><Share2 size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">Facebook</span></a>
            <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`} className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" target="_blank" rel="noreferrer"><div className="w-11 h-11 flex items-center justify-center"><Share2 size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">X / Twitter</span></a>
            <button type="button" className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" onClick={() => navigator.share?.({ title, url: shareUrl })}><div className="w-11 h-11 flex items-center justify-center"><MoreHorizontal size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">More</span></button>
          </div>
          <div className="mx-5 mb-5">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <span className="flex-1 text-xs text-white/50 truncate">{shareUrl}</span>
              <button
                type="button"
                onClick={() => void copyShareLink(shareUrl)}
                className="flex-shrink-0 text-xs font-medium px-2 py-1 rounded-md cursor-pointer"
                style={{ color: copyStatus === 'copied' ? '#4ade80' : '#f97316' }}
              >
                {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {copyStatus === 'copied' ? (
              <p className="text-xs text-center mt-2" style={{ color: '#4ade80' }}>
                Link copied to clipboard
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {/* Play overlay */}
      {modal === 'play' ? (
        <KipemberPlayOverlay
          closeHref={base}
          imageId={data.image.id}
          storyScript={data.snapshotScript}
          guestToken={token}
        />
      ) : null}

      {/* Ember Chat bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30 flex flex-col"
        style={{ background: 'var(--bg-screen)', borderTop: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href={flowOpen ? closeHref : openHref} className="flex-1 text-left">
            <span className="flex items-center gap-2">
              <EmberMark />
              <span className="text-base font-medium" style={{ color: '#f97316' }}>
                Ember
              </span>
            </span>
          </Link>
          <Link
            href={flowOpen ? closeHref : openHref}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ background: flowOpen ? 'rgba(255,255,255,0.15)' : '#f97316' }}
          >
            {flowOpen ? (
              <ChevronDown size={18} color="var(--text-primary)" strokeWidth={1.8} />
            ) : (
              <Plus size={20} color="white" strokeWidth={2} />
            )}
          </Link>
        </div>
        {flowOpen ? <GuestFlow token={token} /> : null}
      </div>
      </div>
    </div>
  );
}
