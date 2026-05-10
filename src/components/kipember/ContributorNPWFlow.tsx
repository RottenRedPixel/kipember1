'use client';

import Link from 'next/link';
import {
  Check,
  Flame,
  Hand,
  Home,
  Link2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Share2,
  X,
} from 'lucide-react';
import EmberModalShell, { type EmberModalSurface } from '@/components/kipember/EmberModalShell';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getEmberTitle } from '@/lib/ember-title';
import { getPreviewMediaUrl } from '@/lib/media';
import { useGuestVoiceRecording } from '@/components/kipember/workflows/useGuestVoiceRecording';
import EmberFlow, { type EmberFlowApi } from '@/components/kipember/workflows/EmberFlow';
import KipemberPlayOverlay from '@/components/kipember/KipemberPlayOverlay';
import KipemberStoriesOverlay from '@/components/kipember/KipemberStoriesOverlay';

type ContributorAttachment = {
  id: string;
  filename: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO';
  posterFilename: string | null;
};

type ContributorData = {
  contributor: {
    id: string;
    name: string | null;
    firstName: string | null;
    phoneNumber: string | null;
    hasPassword: boolean;
  } | null;
  ember: {
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
  attachments: ContributorAttachment[];
  snapshotScript: string | null;
  latestVoiceCall: {
    id: string;
    status: string;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
  } | null;
};


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


export default function ContributorNPWFlow({ token }: { token: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const rawFlow = params.get('ember');
  const view = params.get('view');
  const modal = params.get('m');
  const rawSurface = params.get('chat');

  const flowOpen = rawFlow === 'contributor';
  const emberModalExpanded = flowOpen && view === 'full';
  const emberModalOpen = flowOpen;
  const emberModalSurface: EmberModalSurface =
    rawSurface === 'voice' ? 'voice' : rawSurface === 'calls' ? 'calls' : 'chats';

  const voice = useGuestVoiceRecording(token);

  const [data, setData] = useState<ContributorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [helloDismissed, setHelloDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHelloDismissed(!!localStorage.getItem(`hello-dismissed-${token}`));
    }
  }, [token]);

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
      const response = await fetch(`/api/contribute/${token}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load this memory');
      const payload = (await response.json()) as ContributorData;
      setData({ ...payload, attachments: payload.attachments ?? [], snapshotScript: payload.snapshotScript ?? null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this memory');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Skip hello modal if already dismissed
  useEffect(() => {
    if (modal === 'hello' && typeof window !== 'undefined') {
      if (localStorage.getItem(`hello-dismissed-${token}`)) {
        const p = new URLSearchParams(params.toString());
        p.delete('m');
        const q = p.toString();
        const dest = `/contribute/${token}`;
        router.replace(q ? `${dest}?${q}` : dest);
      }
    }
  }, [modal, token, params, router]);

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

  const title = getEmberTitle({ title: data.ember.title, originalName: data.ember.originalName });
  const subtitle = data.ember.createdAt
    ? new Date(data.ember.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';
  const mainUrl = getPreviewMediaUrl({
    mediaType: data.ember.mediaType,
    filename: data.ember.filename,
    posterFilename: data.ember.posterFilename,
  });

  const allMedia = [
    { url: mainUrl },
    ...data.attachments.map((a) => ({
      url: getPreviewMediaUrl({ mediaType: a.mediaType, filename: a.filename, posterFilename: a.posterFilename }),
    })),
  ];
  const currentPhotoUrl = allMedia[photoIndex]?.url ?? mainUrl;
  const nextPhotoUrl = allMedia.length > 1 ? allMedia[(photoIndex + 1) % allMedia.length]?.url : null;
  const phoneNumber = data.contributor?.phoneNumber ?? '';
  const firstName = data.contributor?.firstName ?? undefined;

  const npwApi: EmberFlowApi = {
    sendChat: async (text) => {
      const res = await fetch(`/api/contribute/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || 'Failed to send message.');
      return typeof payload?.response === 'string' ? payload.response.trim() : null;
    },
    loadWelcome: async () => {
      const res = await fetch(`/api/contribute/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '__START__' }),
      });
      if (!res.ok) return null;
      const payload = await res.json().catch(() => null);
      return typeof payload?.response === 'string' ? payload.response.trim() : null;
    },
    uploadPhoto: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/contribute/${token}/upload`, { method: 'POST', body: formData });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || 'Failed to add content.');
      const filename: string = payload?.attachment?.filename ?? '';
      const reply = typeof payload?.response === 'string' ? payload.response.trim() : null;
      return { filename, reply };
    },
    loadCallProfile: async () => ({ phoneNumber, firstName: firstName ?? '' }),
    triggerCall: async () => {
      const res = await fetch(`/api/contribute/${token}/call`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || 'Could not start the call.');
      }
    },
  };

  const base = `/contribute/${token}`;
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

  const openHref = buildHref({ ember: 'contributor', m: null });
  const closeHref = buildHref({ ember: null, view: null, chat: null, m: null });
  const expandHref = buildHref({ view: 'full' });
  const collapseHref = buildHref({ view: null });
  const chatTabHref = buildHref({ chat: null });
  const voiceTabHref = buildHref({ chat: 'voice' });
  const callTabHref = buildHref({ chat: 'calls' });
  const shareUrl = typeof window !== 'undefined' ? window.location.origin + base : base;

  const railHidden = emberModalOpen || modal === 'share' || modal === 'play' || modal === 'stories' || modal === 'hello';

  return (
    <div className="fixed inset-0 flex justify-center" style={{ background: 'var(--bg-screen)' }}>
      <div className="relative w-full max-w-xl h-full">
        {/* Background blur layer */}
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

        {/* Photo dot indicators */}
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

        {/* Header */}
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
          <div className="w-9 h-9" />
        </div>

        {/* Title overlay */}
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

        {/* Right rail */}
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
          {!helloDismissed ? (
            <Link href={buildHref({ m: 'hello' })} className="flex flex-col items-center gap-1 p-2 rounded-xl">
              <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: '#f97316' }}>
                <Hand size={23} color="#fff" strokeWidth={1.8} />
              </div>
              <span className="text-white text-xs font-medium lowercase">hello!</span>
            </Link>
          ) : null}
          <RailBtn icon={Share2} label="share" href={buildHref({ m: 'share' })} />
          <RailBtn icon={Flame} label="stories" href={buildHref({ m: 'stories' })} />
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

        {/* Hello modal */}
        {modal === 'hello' ? (
          <Modal closeHref={buildHref({ m: null })}>
            <div className="flex flex-col items-center pt-6 pb-4 gap-2">
              <div className="rounded-full flex items-center justify-center" style={{ width: 55, height: 55, background: '#f97316' }}>
                <Hand size={28} color="#fff" strokeWidth={1.6} />
              </div>
              <span className="text-white text-base font-medium">
                {data?.contributor ? `Hello ${data.contributor.firstName ?? 'there'}!` : 'Welcome!'}
              </span>
              <p className="text-white/60 text-sm text-center px-6 pb-2">
                {data?.contributor
                  ? "You've been invited to help build this memory. Add photos, share stories, and contribute what you remember."
                  : "You've been invited to contribute to this memory. Explore the story and chat with Ember."}
              </p>
            </div>
            <div className="mx-5" style={{ borderTop: '1px solid var(--border-default)' }} />
            <div className="px-5 pt-3 pb-4">
              {data?.contributor && data.contributor.hasPassword ? (
                <Link
                  href={`/login?next=${encodeURIComponent(`/inbound/${token}`)}`}
                  className="flex items-center justify-center rounded-full text-white text-sm font-medium w-full"
                  style={{ background: '#f97316', minHeight: 44 }}
                >
                  Login
                </Link>
              ) : data?.contributor && !data.contributor.hasPassword ? (
                <Link
                  href={`/api/contribute/${token}/claim`}
                  className="flex items-center justify-center rounded-full text-white text-sm font-medium w-full"
                  style={{ background: '#f97316', minHeight: 44 }}
                >
                  Create Account
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const next = !helloDismissed;
                    setHelloDismissed(next);
                    if (next) {
                      localStorage.setItem(`hello-dismissed-${token}`, '1');
                    } else {
                      localStorage.removeItem(`hello-dismissed-${token}`);
                    }
                  }}
                  className="flex items-center justify-center gap-2 w-full cursor-pointer"
                  style={{ padding: '6px 0' }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: `1px solid ${helloDismissed ? '#f97316' : 'rgba(255,255,255,0.25)'}`,
                    background: helloDismissed ? '#f97316' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {helloDismissed ? <Check size={10} color="#fff" strokeWidth={3} /> : null}
                  </div>
                  <span className="text-white/40 text-xs">Don't show again</span>
                </button>
              )}
            </div>
          </Modal>
        ) : null}

        {/* Play overlay */}
        {modal === 'play' ? (
          <KipemberPlayOverlay
            closeHref={buildHref({ m: null })}
            emberId={data.ember.id}
            storyScript={data.snapshotScript}
            guestToken={token}
          />
        ) : null}

        {/* Stories overlay */}
        {modal === 'stories' ? (
          <KipemberStoriesOverlay
            closeHref={buildHref({ m: null })}
            emberId={data.ember.id}
            storyScript={data.snapshotScript}
            guestToken={token}
          />
        ) : null}

        {modal !== 'stories' ? (
          <EmberModalShell
            isOpen={emberModalOpen}
            isExpanded={emberModalExpanded}
            openHref={openHref}
            closeHref={closeHref}
            expandHref={expandHref}
            collapseHref={collapseHref}
            surface={emberModalSurface}
            tabs={[
              { label: 'Chat', surface: 'chats', href: chatTabHref },
              { label: 'Voice', surface: 'voice', href: voiceTabHref },
              { label: 'Call', surface: 'calls', href: callTabHref },
            ]}
          >
            <EmberFlow
              key={token}
              api={npwApi}
              voice={voice}
              emberModalSurface={emberModalSurface}
              chatPlaceholder="Ask Ember about this memory..."
              canUploadPhoto
              canCall
            />
          </EmberModalShell>
        ) : null}
      </div>
    </div>
  );
}
