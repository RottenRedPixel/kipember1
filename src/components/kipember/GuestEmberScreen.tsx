'use client';

import Link from 'next/link';
import { Flame, Hand, Images, MessageCirclePlus, Share } from 'lucide-react';
import AppHeader from '@/components/kipember/AppHeader';
import GuestEmberSheet from '@/components/kipember/GuestEmberSheet';
import HelloSheet from '@/app/ember/[id]/HelloSheet';
import ShareSheet from '@/app/ember/[id]/ShareSheet';
import StoriesSheet from '@/app/ember/[id]/StoriesSheet';
import EmberTitleBlock from '@/app/ember/[id]/EmberTitleBlock';
import { getPreviewMediaUrl } from '@/lib/media';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GuestEmberApi } from '@/components/kipember/GuestEmberSheet';

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
  attachments: GuestAttachment[];
  snapshotScript: string | null;
};

const TAB_H = 80;
const SNAP_MS = 260;
const SWIPE_THRESHOLD = 50;

const tabItems = [
  { label: 'hello', icon: Hand },
  { label: 'ember', icon: MessageCirclePlus },
  { label: 'stories', icon: Flame },
  { label: 'share', icon: Share },
] as const;

export default function GuestEmberScreen({
  token,
  dataApiPath = '/api/contributor',
  chatApiPath = '/api/contributor',
  basePath = '/contributor',
}: {
  token: string;
  dataApiPath?: string;
  chatApiPath?: string;
  basePath?: string;
}) {
  const [data, setData] = useState<GuestData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Photo card state
  const [mediaIndex, setMediaIndex] = useState(0);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'square' | null>(null);
  const [naturalRatio, setNaturalRatio] = useState<string | null>(null);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [snapping, setSnapping] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; axis: 'h' | 'v' | null } | null>(null);
  const lastDirRef = useRef<1 | -1>(1);

  const panelOpen = activeTab !== null;
  const objectPosition = orientation === 'portrait' ? 'center top' : 'center';

  const isContributor = Boolean(data?.contributor);

  const guestApi: GuestEmberApi = {
    sendChat: async (text: string) => {
      const res = await fetch(`${chatApiPath}/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || 'Failed to send message.');
      return typeof payload?.response === 'string' ? payload.response.trim() : null;
    },
    loadWelcome: async () => {
      const res = await fetch(`${chatApiPath}/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '__START__' }),
      });
      if (!res.ok) return null;
      const payload = await res.json().catch(() => null);
      return typeof payload?.response === 'string' ? payload.response.trim() : null;
    },
  };

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${dataApiPath}/${token}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load this memory');
      const payload = (await response.json()) as GuestData;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this memory');
    } finally {
      setIsLoading(false);
    }
  }, [dataApiPath, token]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Build media array
  const coverMedia = data
    ? { filename: data.ember.filename, mediaType: data.ember.mediaType, posterFilename: data.ember.posterFilename }
    : null;
  const allMedia = coverMedia
    ? [coverMedia, ...(data?.attachments ?? []).map((a) => ({ filename: a.filename, mediaType: a.mediaType as 'IMAGE' | 'VIDEO', posterFilename: a.posterFilename }))]
    : [];
  const currentMedia = allMedia[mediaIndex] ?? coverMedia;
  const photoUrl = currentMedia
    ? getPreviewMediaUrl({ mediaType: currentMedia.mediaType, filename: currentMedia.filename, posterFilename: currentMedia.posterFilename })
    : null;

  // Share URL is the current page
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${basePath}/${token}` : `${basePath}/${token}`;

  function snapBack() {
    setSnapping(true);
    setSwipeX(0);
    setTimeout(() => setSnapping(false), SNAP_MS);
  }

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setPhotoLoaded(true);
    setNaturalRatio(`${w}/${h}`);
    if (w === h) setOrientation('square');
    else if (w > h) setOrientation('landscape');
    else setOrientation('portrait');

    const incomingX = lastDirRef.current < 0 ? window.innerWidth : -window.innerWidth;
    setSwipeX(incomingX);
    setSnapping(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSnapping(true);
        setSwipeX(0);
        setTimeout(() => setSnapping(false), SNAP_MS);
      });
    });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (panelOpen) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, axis: null };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (dragRef.current.axis === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      dragRef.current.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
    if (dragRef.current.axis === 'h') setSwipeX(dx);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const axis = dragRef.current.axis;
    dragRef.current = null;

    if (axis !== 'h' || Math.abs(dx) < SWIPE_THRESHOLD) { snapBack(); return; }

    const dir: 1 | -1 = dx < 0 ? -1 : 1;
    const nextMediaIndex = mediaIndex + (dir < 0 ? 1 : -1);
    if (nextMediaIndex >= 0 && nextMediaIndex < allMedia.length) {
      lastDirRef.current = dir;
      setSnapping(true);
      setSwipeX(dir < 0 ? -window.innerWidth : window.innerWidth);
      setTimeout(() => {
        setMediaIndex(nextMediaIndex);
        setPhotoLoaded(false);
      }, SNAP_MS);
      return;
    }
    snapBack();
  }

  function handlePointerCancel() {
    dragRef.current = null;
    snapBack();
  }

  const closePanel = () => setActiveTab(null);

  const spacerHeight =
    activeTab === 'hello' ? '50vh' :
    activeTab === 'ember' ? '50vh' :
    activeTab === 'stories' ? '30vh' :
    activeTab === 'share' ? '20vh' :
    TAB_H;

  const tabHidden = panelOpen;

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

  return (
    <div className="fixed inset-0" style={{ background: 'var(--bg-screen)' }}>
      <div style={{ '--border-subtle': 'transparent' } as React.CSSProperties}>
        <AppHeader avatarUrl={null} hasPassword={false} />
      </div>

      <div className="fixed inset-0 flex flex-col" style={{ paddingTop: 56 }}>
        <EmberTitleBlock title={data.ember.title} createdAt={data.ember.createdAt} />

        {/* Photo card */}
        <div className={`flex-1 min-h-0 px-[10px] pb-3 flex ${orientation === 'portrait' ? 'items-start' : 'items-center'} justify-center overflow-hidden`}>
          {photoUrl ? (
            <div
              className="rounded-2xl overflow-hidden cursor-pointer relative"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onClick={() => { if (swipeX === 0) setActiveTab(null); }}
              style={{
                border: '1px solid var(--border-default)',
                background: 'transparent',
                aspectRatio: naturalRatio ?? '4/3',
                transform: `translateX(${swipeX}px)`,
                transition: snapping ? `transform ${SNAP_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)` : 'none',
                touchAction: 'none',
                willChange: 'transform',
                userSelect: 'none',
                ...(orientation === 'portrait'
                  ? { height: '100%', maxWidth: '100%' }
                  : { width: '100%', maxHeight: '100%' }),
              }}
            >
              <img
                src={photoUrl}
                alt=""
                className="w-full h-full"
                style={{ objectFit: 'cover', objectPosition, display: 'block', pointerEvents: 'none', opacity: photoLoaded ? 1 : 0, transition: 'opacity 400ms ease' }}
                onLoad={handleImageLoad}
                draggable={false}
              />
              {/* Multi-photo badge */}
              {allMedia.length > 1 ? (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }}>
                  <Images size={16} className="text-white" strokeWidth={1.8} />
                  <span className="text-white text-sm font-medium leading-none">{allMedia.length}</span>
                </div>
              ) : null}
              {/* Photo dots */}
              {allMedia.length > 1 ? (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5" style={{ pointerEvents: 'none' }}>
                  {allMedia.map((_, i) => (
                    <div key={i} style={{ width: i === mediaIndex ? 16 : 6, height: 6, borderRadius: 3, background: i === mediaIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)', transition: 'width 200ms ease, background 200ms ease' }} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Spacer pushes card up when sheets open */}
        <div style={{ flexShrink: 0, height: spacerHeight, transition: 'height 320ms cubic-bezier(0.4, 0, 0.2, 1)' }} />
      </div>

      {/* Sheets */}
      <HelloSheet
        isOpen={activeTab === 'hello'}
        onClose={closePanel}
        emberId={data.ember.id}
        accessType={null}
        guest={{
          firstName: data.contributor?.firstName ?? null,
          hasPassword: data.contributor?.hasPassword ?? false,
          isContributor: Boolean(data.contributor),
          token,
          createAccountHref: `/api/contribute/${token}/claim`,
        }}
      />
      <GuestEmberSheet
        isOpen={activeTab === 'ember'}
        onClose={closePanel}
        api={guestApi}
      />
      <StoriesSheet
        isOpen={activeTab === 'stories'}
        onClose={closePanel}
        emberId={data.ember.id}
        storyScript={data.snapshotScript}
        accessToken={token}
      />
      <ShareSheet
        isOpen={activeTab === 'share'}
        onClose={closePanel}
        emberId={null}
        overrideShareUrl={shareUrl}
      />

      {/* Tab bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex justify-around px-4 py-4"
        style={{
          background: 'var(--bg-frame)',
          transform: tabHidden ? 'translateY(100%)' : 'translateY(0)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {tabItems.map(({ label, icon: Icon }) => {
          const isActive = activeTab === label;
          const isDimmed = panelOpen ? !isActive : false;
          return (
            <button
              key={label}
              className="flex flex-col items-center gap-1 cursor-pointer transition-opacity duration-200 rounded-xl [@media(hover:hover)]:hover:bg-white/10 px-3 py-1"
              style={{ minWidth: 44, opacity: isDimmed ? 0.25 : 1 }}
              onClick={() => setActiveTab((prev) => prev === label ? null : label)}
            >
              <Icon size={25} color={isActive ? '#f97316' : 'white'} strokeWidth={1.5} />
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
