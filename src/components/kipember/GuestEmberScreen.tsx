'use client';

import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  Home,
  Link2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Plus,
  ScanEye,
  Share2,
  UserPlus,
  X,
} from 'lucide-react';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getEmberTitle } from '@/lib/ember-title';
import { getPreviewMediaUrl } from '@/lib/media';
import GuestFlow from '@/components/kipember/workflows/GuestFlow';
import KipemberPlayOverlay from '@/components/kipember/KipemberPlayOverlay';
import type { EmberModalSurface } from '@/components/kipember/HomeScreen';

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
      <Link href={href} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10 active:bg-white/20">
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10 active:bg-white/20 cursor-pointer">
      {inner}
    </button>
  );
}

export default function GuestEmberScreen({ token }: { token: string }) {
  const params = useSearchParams();
  const rawFlow = params.get('ember');
  const view = params.get('view');
  const modal = params.get('m');
  const rawSurface = params.get('chat');

  // Same modal state shape HomeScreen uses, just with the third surface
  // (calls) elided — guests can read shared calls via the wiki but they
  // can't initiate one, so the tab strip only offers Chat / Voice.
  const flowOpen = rawFlow === 'guest';
  const emberModalExpanded = flowOpen && view === 'full';
  const emberModalOpen = flowOpen;
  const emberModalSurface: Exclude<EmberModalSurface, 'calls'> =
    rawSurface === 'voice' ? 'voice' : 'chats';

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
  const subtitle = data.image.createdAt
    ? new Date(data.image.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';
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
  // Centralised URL builder mirrors HomeScreen.buildHomeHref so the modal
  // open/close/expand/collapse and surface tabs follow the same query-param
  // contract. Setting a key to null deletes it.
  const buildHref = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    const query = next.toString();
    return query ? `${base}?${query}` : base;
  };
  const openHref = buildHref({ ember: 'guest', m: null });
  const closeHref = buildHref({ ember: null, view: null, chat: null, m: null });
  const expandHref = buildHref({ view: 'full' });
  const collapseHref = buildHref({ view: null });
  const chatTabHref = buildHref({ chat: null });
  const voiceTabHref = buildHref({ chat: 'voice' });
  const shareUrl = typeof window !== 'undefined' ? window.location.origin + base : base;

  // The right rail must hide whenever the Ember modal is open or any other
  // overlay is showing — same rule HomeScreen uses for the rail.
  const railHidden = emberModalOpen || modal === 'share' || modal === 'play';

  return (
    <div className="fixed inset-0 flex justify-center" style={{ background: 'var(--bg-screen)' }}>
      {/* No overflow-hidden on this wrapper: the background blur layer
          uses transform: scale(1.08), which makes its visual bounding box
          larger than the wrapper. Combined with overflow-hidden, that
          fakes scrollable content and lets browser focus-into-view scroll
          the wrapper internally — yanking every absolute child (header,
          title, modal) up. HomeScreen omits it for the same reason. */}
      <div className="relative w-full max-w-xl h-full">
        {/* Background blur layer + photo, sized into the band between the
            56px header and the 72px Ember bar. When expanded, the photo
            letterboxes into the top 25% to make room for the larger modal. */}
        <div className="absolute inset-0 pointer-events-none">
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
          <img
            src={currentPhotoUrl}
            alt=""
            className="absolute pointer-events-none"
            style={
              emberModalExpanded
                ? {
                    top: 56,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    height: 'calc(25vh - 56px)',
                    width: 'auto',
                    objectFit: 'contain',
                    objectPosition: 'center center',
                  }
                : {
                    top: 56,
                    bottom: 72,
                    left: 0,
                    right: 0,
                    width: '100%',
                    height: 'calc(100% - 128px)',
                    objectFit: 'contain',
                    objectPosition: 'center center',
                  }
            }
          />
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.55) 100%)' }}
        />

        {/* Photo dot indicators (multi-photo only, hidden when modal is
            expanded). Same pattern HomeScreen uses, sitting just above the
            Ember bar. */}
        {allMedia.length > 1 && !emberModalExpanded ? (
          <div
            className="absolute left-1/2 flex items-center gap-1.5 pointer-events-none z-10"
            style={{ bottom: 88, transform: 'translateX(-50%)' }}
          >
            {allMedia.map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: idx === photoIndex ? '#ffffff' : 'rgba(255,255,255,0.35)',
                  boxShadow: idx === photoIndex ? '0 1px 3px rgba(0,0,0,0.5)' : 'none',
                  transition: 'background 200ms ease',
                }}
              />
            ))}
          </div>
        ) : null}

        {/* Header — 56px chrome matching AppHeader's height + border. Guest
            has no avatar/account, so the slots are Home (back to /) on the
            left and a sign-up CTA on the right; the title overlay below
            handles the centre. */}
        <div
          className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4"
          style={{ height: 56, background: 'var(--bg-screen)', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <Link
            href="/"
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--bg-rail-btn)' }}
            aria-label="Home"
          >
            <Home size={18} color="var(--text-primary)" strokeWidth={1.8} />
          </Link>
          <Link
            href="/signup"
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(249,115,22,0.85)' }}
            aria-label="Sign up"
          >
            <UserPlus size={18} color="white" strokeWidth={1.8} />
          </Link>
        </div>

        {/* Title overlay — same position rule HomeScreen uses (top: 64,
            left-4, two lines). Hidden when the modal is expanded so the
            shrunken photo isn't crowded by chrome. */}
        {!emberModalExpanded ? (
          <div className="absolute left-4 z-20 pointer-events-none" style={{ top: 64 }}>
            <p className="text-white font-medium text-base leading-tight" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
              {title}
            </p>
            {subtitle ? (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                {subtitle}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Right rail — `right-2 bottom: 9%` matches HomeScreen exactly.
            Fades out when the Ember modal opens so it doesn't sit on top
            of the sheet. Tend isn't here because guests can't tend. */}
        <div
          className={`absolute right-2 z-20 flex flex-col gap-0 items-center transition-opacity duration-200 ${
            railHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          style={{ bottom: '9%' }}
        >
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
          <RailBtn icon={Share2} label="share" href={buildHref({ m: 'share' })} />
          <RailBtn icon={ScanEye} label="view" href={buildHref({ m: 'play' })} />
        </div>

        {/* Share modal */}
        {modal === 'share' ? (
          <Modal closeHref={buildHref({ m: null })}>
            <div className="flex flex-col items-center pt-6 pb-4 gap-2">
              <div className="rounded-full flex items-center justify-center" style={{ width: 55, height: 55, background: '#4a6172' }}>
                <Share2 size={28} color="#c8dce8" strokeWidth={1.6} />
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
              {/* Confirmation lives above the URL row so the user sees
                  feedback right after tapping Copy Link or the inline
                  Copy button. Auto-clears after 2s via copyShareLink. */}
              {copyStatus === 'copied' ? (
                <p className="text-xs text-center mb-2" style={{ color: '#4ade80' }}>
                  Link copied to clipboard
                </p>
              ) : null}
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
            </div>
          </Modal>
        ) : null}

        {/* Play overlay */}
        {modal === 'play' ? (
          <KipemberPlayOverlay
            closeHref={buildHref({ m: null })}
            imageId={data.image.id}
            storyScript={data.snapshotScript}
            guestToken={token}
          />
        ) : null}

        {/* Ember modal — anchored to the bottom. Closed: just the brand
            row. Open (position-1): caps at 65% from the top. Expanded
            (position-2): caps at 25% from the top. backdrop-filter +
            border-radius mirror HomeScreen so the chrome looks identical. */}
        <div
          className="absolute bottom-0 left-0 right-0 z-30 flex flex-col overflow-hidden"
          style={{
            top: emberModalExpanded ? '25%' : emberModalOpen ? '65%' : 'auto',
            background: 'var(--bg-screen)',
            WebkitBackdropFilter: 'blur(20px)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid var(--border-subtle)',
            borderRadius: emberModalOpen ? '20px 20px 0 0' : undefined,
            transition: 'top 200ms ease',
          }}
        >
          <div className="relative flex items-center gap-3 pl-2 pr-4 py-3 flex-shrink-0">
            <Link href={flowOpen ? closeHref : openHref} className="flex-1 text-left">
              <span className="flex items-center gap-1">
                <EmberMark />
                <span className="text-base font-medium" style={{ color: '#f97316' }}>
                  Ember
                </span>
              </span>
            </Link>
            {flowOpen ? (
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 rounded-xl p-1"
                style={{ background: 'var(--bg-surface)' }}
              >
                <Link
                  href={chatTabHref}
                  className="px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: emberModalSurface === 'chats' ? 'var(--bg-screen)' : 'transparent',
                    color: emberModalSurface === 'chats' ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  Chat
                </Link>
                <Link
                  href={voiceTabHref}
                  className="px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: emberModalSurface === 'voice' ? 'var(--bg-screen)' : 'transparent',
                    color: emberModalSurface === 'voice' ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  Voice
                </Link>
              </div>
            ) : null}
            {flowOpen && !emberModalExpanded ? (
              <Link
                href={expandHref}
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                aria-label="Expand chat"
              >
                <ChevronUp size={18} color="var(--text-secondary)" strokeWidth={1.8} />
              </Link>
            ) : null}
            {flowOpen && emberModalExpanded ? (
              <Link
                href={collapseHref}
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                aria-label="Collapse chat"
              >
                <ChevronDown size={18} color="var(--text-primary)" strokeWidth={1.8} />
              </Link>
            ) : null}
            <Link
              href={flowOpen ? closeHref : openHref}
              className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ background: flowOpen ? 'rgba(255,255,255,0.15)' : '#f97316' }}
            >
              {flowOpen ? (
                <X size={18} color="var(--text-primary)" strokeWidth={1.8} />
              ) : (
                <Plus size={20} color="white" strokeWidth={2} />
              )}
            </Link>
          </div>
          {flowOpen ? (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <GuestFlow token={token} emberModalSurface={emberModalSurface} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
