'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Flame, Hand, Images, Leaf, MessageCirclePlus, Share } from 'lucide-react';
import { getPreviewMediaUrl } from '@/lib/media';
import { readEmberPreview } from '@/lib/ember-preview-cache';
import AppHeader from '@/components/kipember/AppHeader';
import KipemberAccountOverlay from '@/components/kipember/KipemberAccountOverlay';
import EmberSheet from './EmberSheet';
import EmberTitleBlock from './EmberTitleBlock';
import HelloSheet from './HelloSheet';
import ShareSheet from './ShareSheet';
import StoriesSheet from './StoriesSheet';
import TendSheet from './TendSheet';

type EmberSummary = {
  id: string;
  filename: string;
  mediaType: string;
  posterFilename: string | null;
  title: string | null;
  originalName: string;
  createdAt: string;
  snapshot: { script: string } | null;
  accessType: 'owner' | 'contributor' | 'network' | null;
};

type AttachmentItem = {
  filename: string;
  mediaType: string;
  posterFilename: string | null;
};

const TAB_H = 80;
const CARD_H = '50vh';
const SWIPE_THRESHOLD = 50;
const SNAP_MS = 260;

const tabItems = [
  { label: 'hello', icon: Hand },
  { label: 'ember', icon: MessageCirclePlus },
  { label: 'stories', icon: Flame },
  { label: 'tend', icon: Leaf },
  { label: 'share', icon: Share },
] as const;

function EmberViewContent() {
  const { id: routeId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const modal = searchParams.get('m');

  const accountOpenHref = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('m', 'account');
    return `/ember/${routeId}?${next.toString()}`;
  }, [searchParams, routeId]);

  const accountCloseHref = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('m');
    const query = next.toString();
    return query ? `/ember/${routeId}?${query}` : `/ember/${routeId}`;
  }, [searchParams, routeId]);
  const [id, setId] = useState(routeId);
  // Seed from the preview cache written by the list view on tap.
  // This gives us filename immediately so the image starts loading before
  // the full /api/embers/[id] fetch resolves.
  const cached = typeof window !== 'undefined' ? readEmberPreview(routeId) : null;
  const [ember, setEmber] = useState<EmberSummary | null>(
    cached ? { ...cached, snapshot: null, accessType: null } as EmberSummary : null
  );
  const [emberIds, setEmberIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [emberOpen, setEmberOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'square' | null>(null);
  const [naturalRatio, setNaturalRatio] = useState<string | null>(null);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [snapping, setSnapping] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);
  const prefetchCacheRef = useRef<Record<string, EmberSummary>>({});
  const panelOpen = emberOpen || activeTab !== null;

  const objectPosition = orientation === 'portrait' ? 'center top' : 'center';
  const currentIndex = id ? emberIds.indexOf(id) : -1;

  // Build the full media array: cover photo + attachments
  const coverMedia: AttachmentItem | null = ember
    ? { filename: ember.filename, mediaType: ember.mediaType, posterFilename: ember.posterFilename }
    : null;
  const allMedia: AttachmentItem[] = coverMedia ? [coverMedia, ...attachments] : [];
  const currentMedia = allMedia[mediaIndex] ?? coverMedia;

  const photoUrl = currentMedia
    ? getPreviewMediaUrl({
        mediaType: currentMedia.mediaType as 'IMAGE' | 'VIDEO',
        filename: currentMedia.filename,
        posterFilename: currentMedia.posterFilename,
      })
    : null;

  // Tab items filtered by access type
  const visibleTabItems = tabItems.filter(({ label }) => {
    if (label === 'tend' && ember?.accessType === 'contributor') return false;
    return true;
  });

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
  }

  function slideInFromHorizontal(dir: 1 | -1) {
    // Place the new card off-screen on the opposite side of the swipe (no animation),
    // then animate it to 0. Deterministic — does not depend on image onLoad firing.
    setSnapping(false);
    setSwipeX(dir < 0 ? window.innerWidth : -window.innerWidth);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSnapping(true);
        setSwipeX(0);
        setTimeout(() => setSnapping(false), SNAP_MS);
      });
    });
  }

  useEffect(() => {
    fetch('/api/embers')
      .then((r) => r.json())
      .then((data: EmberSummary[]) => setEmberIds(data.map((e) => e.id)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    // Only hide the image when we don't already have data for this id.
    // If ember was seeded from the sessionStorage preview cache, the image
    // may already be in the browser cache and fire onLoad before this effect
    // runs — resetting photoLoaded here would hide it permanently since the
    // img element won't remount and onLoad won't fire again.
    setEmber((prev) => {
      if (!prev || prev.id !== id) setPhotoLoaded(false);
      return prev;
    });
    setMediaIndex(0);
    const prefetched = prefetchCacheRef.current[id];
    if (prefetched) { setEmber(prefetched); return; }
    fetch(`/api/embers/${id}`)
      .then((r) => r.json())
      .then((data: EmberSummary) => { prefetchCacheRef.current[id] = data; setEmber(data); })
      .catch(() => {});
  }, [id]);

  // Fetch attachments when ember changes
  useEffect(() => {
    if (!id) return;
    setAttachments([]);
    fetch(`/api/embers/${id}/attachments`)
      .then((r) => r.json())
      .then((data) => { if (data.attachments) setAttachments(data.attachments); })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!ember || emberIds.length === 0) return;
    const neighbors = [currentIndex - 1, currentIndex + 1]
      .filter((i) => i >= 0 && i < emberIds.length)
      .map((i) => emberIds[i]);
    for (const neighborId of neighbors) {
      const prefetch = (data: EmberSummary) => {
        prefetchCacheRef.current[neighborId] = data;
        new Image().src = getPreviewMediaUrl({
          mediaType: data.mediaType as 'IMAGE' | 'VIDEO',
          filename: data.filename,
          posterFilename: data.posterFilename,
        });
      };
      const cached = prefetchCacheRef.current[neighborId];
      if (cached) { prefetch(cached); continue; }
      fetch(`/api/embers/${neighborId}`)
        .then((r) => r.json())
        .then((data: EmberSummary) => prefetch(data))
        .catch(() => {});
    }
  }, [ember, emberIds, currentIndex]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (panelOpen || snapping) return;
    try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch {}
    dragRef.current = { startX: e.clientX, startY: e.clientY };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    setSwipeX(dx);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    dragRef.current = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD) { snapBack(); return; }

    // Horizontal swipe — navigate between embers
    const dir: 1 | -1 = dx < 0 ? -1 : 1; // swipe-left = -1 (next), swipe-right = 1 (prev)
    const targetIndex = dir < 0 ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= emberIds.length) { snapBack(); return; }
    setSnapping(true);
    setSwipeX(dir < 0 ? -window.innerWidth : window.innerWidth);
    setTimeout(() => {
      setMediaIndex(0);
      setId(emberIds[targetIndex]);
      slideInFromHorizontal(dir);
    }, SNAP_MS);
  }

  function handlePointerCancel() {
    dragRef.current = null;
    snapBack();
  }

  const closePanel = () => setActiveTab(null);

  const spacerHeight = emberOpen
    ? CARD_H
    : activeTab === 'hello'
    ? '50vh'
    : activeTab === 'share'
    ? '25vh'
    : activeTab === 'stories'
    ? '30vh'
    : TAB_H;

  const tabHidden = activeTab === 'stories' || activeTab === 'hello' || activeTab === 'share' || emberOpen;

  return (
    <>
      <div style={{ '--border-subtle': 'transparent' } as React.CSSProperties}>
        <AppHeader userModalHref={accountOpenHref} />
      </div>
      <div className="fixed inset-0 flex flex-col" style={{ paddingTop: 56 }}>
        <EmberTitleBlock title={ember?.title} createdAt={ember?.createdAt} />
        <div
          className={`flex-1 min-h-0 px-[10px] pb-3 flex ${orientation === 'portrait' ? 'items-start' : 'items-center'} justify-center overflow-hidden cursor-pointer`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onClick={() => { if (swipeX === 0) { setEmberOpen(false); setActiveTab(null); } }}
          style={{ touchAction: 'none', userSelect: 'none' }}
        >
          {photoUrl ? (
            <div
              className="rounded-2xl overflow-hidden relative"
              style={{
                border: '1px solid var(--border-default)',
                background: 'transparent',
                aspectRatio: naturalRatio ?? '4/3',
                transform: `translateX(${swipeX}px)`,
                transition: snapping ? `transform ${SNAP_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)` : 'none',
                willChange: 'transform',
                pointerEvents: 'none',
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
              {/* Photo dots indicator */}
              {allMedia.length > 1 ? (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5" style={{ pointerEvents: 'none' }}>
                  {allMedia.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: i === mediaIndex ? 16 : 6,
                        height: 6,
                        borderRadius: 3,
                        background: i === mediaIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                        transition: 'width 200ms ease, background 200ms ease',
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div style={{ flexShrink: 0, height: spacerHeight, transition: 'height 320ms cubic-bezier(0.4, 0, 0.2, 1)' }} />
      </div>

      <EmberSheet isOpen={emberOpen} onClose={() => setEmberOpen(false)} emberId={id} />
      <HelloSheet isOpen={activeTab === 'hello'} onClose={closePanel} emberId={id} accessType={ember?.accessType ?? null} />
      <StoriesSheet isOpen={activeTab === 'stories'} onClose={closePanel} emberId={id} storyScript={ember?.snapshot?.script ?? null} />
      <ShareSheet isOpen={activeTab === 'share'} onClose={closePanel} emberId={id} />
      <TendSheet isOpen={activeTab === 'tend'} onClose={closePanel} emberId={id} />

      {modal === 'account' && <KipemberAccountOverlay closeHref={accountCloseHref} />}

      {/* Tab bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex justify-around px-4 py-4"
        style={{
          background: '#0d1f12',
          transform: tabHidden ? 'translateY(100%)' : 'translateY(0)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {visibleTabItems.map(({ label, icon: Icon }) => {
          const isActive = label === 'ember' ? emberOpen : activeTab === label;
          const isDimmed = panelOpen ? !isActive : false;
          return (
            <button
              key={label}
              className="flex flex-col items-center gap-1 cursor-pointer transition-opacity duration-200 rounded-xl [@media(hover:hover)]:hover:bg-white/10 px-3 py-1"
              style={{ minWidth: 44, opacity: isDimmed ? 0.25 : 1 }}
              onClick={() => {
                if (label === 'ember') { setEmberOpen((o) => !o); setActiveTab(null); }
                else { setEmberOpen(false); setActiveTab((prev) => prev === label ? null : label); }
              }}
            >
              <Icon size={25} color="white" strokeWidth={1.5} />
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function EmberViewClient() {
  return (
    <div className="fixed inset-0" style={{ background: 'var(--bg-screen)' }}>
      <Suspense>
        <EmberViewContent />
      </Suspense>
    </div>
  );
}
