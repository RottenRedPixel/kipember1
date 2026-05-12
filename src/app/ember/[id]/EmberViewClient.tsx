'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Flame, Hand, Images, Leaf, MessageCirclePlus, Share } from 'lucide-react';
import { getPreviewMediaUrl } from '@/lib/media';
import AppHeader from '@/components/kipember/AppHeader';
import EmberSheet from './EmberSheet';
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

const RAIL_H = 80;
const CARD_H = '50vh';
const SWIPE_THRESHOLD = 50;
const SNAP_MS = 260;

const railItems = [
  { label: 'hello', icon: Hand },
  { label: 'ember', icon: MessageCirclePlus },
  { label: 'stories', icon: Flame },
  { label: 'tend', icon: Leaf },
  { label: 'share', icon: Share },
] as const;

function EmberViewContent() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [ember, setEmber] = useState<EmberSummary | null>(null);
  const [emberIds, setEmberIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [emberOpen, setEmberOpen] = useState(false);
  const [activeRail, setActiveRail] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'square' | null>(null);
  const [naturalRatio, setNaturalRatio] = useState<string | null>(null);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [swipeY, setSwipeY] = useState(0);
  const [snapping, setSnapping] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; axis: 'h' | 'v' | null } | null>(null);
  const lastDirRef = useRef<1 | -1>(1);
  const lastNavAxisRef = useRef<'h' | 'v'>('h');
  const prefetchCacheRef = useRef<Record<string, EmberSummary>>({});
  const panelOpen = emberOpen || activeRail !== null;

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

  // Rail items filtered by access type
  const visibleRailItems = railItems.filter(({ label }) => {
    if (label === 'tend' && ember?.accessType === 'contributor') return false;
    return true;
  });

  function snapBack() {
    setSnapping(true);
    setSwipeX(0);
    setSwipeY(0);
    setTimeout(() => setSnapping(false), SNAP_MS);
  }

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setPhotoLoaded(true);
    setNaturalRatio(`${w}/${h}`);
    if (w === h) setOrientation('square');
    else if (w > h) setOrientation('landscape');
    else setOrientation('portrait');

    if (lastNavAxisRef.current === 'v') {
      const incomingY = lastDirRef.current < 0 ? window.innerHeight : -window.innerHeight;
      setSwipeY(incomingY);
      setSwipeX(0);
    } else {
      const incomingX = lastDirRef.current < 0 ? window.innerWidth : -window.innerWidth;
      setSwipeX(incomingX);
      setSwipeY(0);
    }
    setSnapping(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSnapping(true);
        setSwipeX(0);
        setSwipeY(0);
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
    setPhotoLoaded(false);
    setMediaIndex(0);
    const cached = prefetchCacheRef.current[id];
    if (cached) { setEmber(cached); return; }
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
    if (dragRef.current.axis === 'v') setSwipeY(dy);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const axis = dragRef.current.axis;
    dragRef.current = null;

    // Vertical swipe — navigate between embers
    if (axis === 'v') {
      if (Math.abs(dy) < SWIPE_THRESHOLD) { snapBack(); return; }
      const dir: 1 | -1 = dy < 0 ? -1 : 1; // up = -1 (next), down = 1 (prev)
      const targetIndex = dir < 0 ? currentIndex + 1 : currentIndex - 1;
      if (targetIndex < 0 || targetIndex >= emberIds.length) { snapBack(); return; }
      lastDirRef.current = dir;
      lastNavAxisRef.current = 'v';
      setSnapping(true);
      setSwipeY(dir < 0 ? -window.innerHeight : window.innerHeight);
      setTimeout(() => {
        setMediaIndex(0);
        router.replace(`/ember/${emberIds[targetIndex]}`);
      }, SNAP_MS);
      return;
    }

    if (axis !== 'h' || Math.abs(dx) < SWIPE_THRESHOLD) { snapBack(); return; }

    const dir: 1 | -1 = dx < 0 ? -1 : 1;
    lastNavAxisRef.current = 'h';

    // Horizontal swipe only cycles through the photo carousel
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

    // No more photos in this direction — snap back
    snapBack();
  }

  function handlePointerCancel() {
    dragRef.current = null;
    snapBack();
  }

  const closePanel = () => setActiveRail(null);

  const spacerHeight = emberOpen
    ? CARD_H
    : activeRail === 'hello'
    ? '50vh'
    : activeRail === 'share'
    ? '25vh'
    : activeRail === 'stories'
    ? '30vh'
    : RAIL_H;

  const railHidden = activeRail === 'stories' || activeRail === 'hello' || activeRail === 'share' || emberOpen;

  return (
    <>
      <div className="fixed inset-0 flex flex-col" style={{ paddingTop: 56 }}>
        {(ember?.title || ember?.createdAt) ? (
          <div className="px-[10px] pt-2 pb-1 flex-shrink-0">
            {ember?.title ? (
              <p className="font-semibold" style={{ fontSize: 15, color: '#fff' }}>{ember.title}</p>
            ) : null}
            {ember?.createdAt ? (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                {new Date(ember.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className={`flex-1 min-h-0 px-[10px] pb-3 flex ${orientation === 'portrait' ? 'items-start' : 'items-center'} justify-center overflow-hidden`}>
          {photoUrl ? (
            <div
              className="rounded-2xl overflow-hidden cursor-pointer relative"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onClick={() => { if (swipeX === 0) { setEmberOpen(false); setActiveRail(null); } }}
              style={{
                border: '1px solid var(--border-default)',
                background: photoLoaded ? 'transparent' : 'var(--bg-surface)',
                aspectRatio: naturalRatio ?? '4/3',
                transform: `translateX(${swipeX}px) translateY(${swipeY}px)`,
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
          ) : (
            <div className="rounded-2xl" style={{ width: '100%', aspectRatio: '1/1', background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} />
          )}
        </div>

        <div style={{ flexShrink: 0, height: spacerHeight, transition: 'height 320ms cubic-bezier(0.4, 0, 0.2, 1)' }} />
      </div>

      <EmberSheet isOpen={emberOpen} onClose={() => setEmberOpen(false)} emberId={id} />
      <HelloSheet isOpen={activeRail === 'hello'} onClose={closePanel} emberId={id} accessType={ember?.accessType ?? null} />
      <StoriesSheet isOpen={activeRail === 'stories'} onClose={closePanel} emberId={id} storyScript={ember?.snapshot?.script ?? null} />
      <ShareSheet isOpen={activeRail === 'share'} onClose={closePanel} emberId={id} />
      <TendSheet isOpen={activeRail === 'tend'} onClose={closePanel} emberId={id} />

      {/* Rail */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex justify-around px-4 py-4"
        style={{
          background: '#111113',
          transform: railHidden ? 'translateY(100%)' : 'translateY(0)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {visibleRailItems.map(({ label, icon: Icon }) => {
          const isActive = label === 'ember' ? emberOpen : activeRail === label;
          const isDimmed = panelOpen ? !isActive : false;
          return (
            <button
              key={label}
              className="flex flex-col items-center gap-1 cursor-pointer transition-opacity duration-200 rounded-xl [@media(hover:hover)]:hover:bg-white/10 px-3 py-1"
              style={{ minWidth: 44, opacity: isDimmed ? 0.25 : 1 }}
              onClick={() => {
                if (label === 'ember') { setEmberOpen((o) => !o); setActiveRail(null); }
                else { setEmberOpen(false); setActiveRail((prev) => prev === label ? null : label); }
              }}
            >
              <Icon size={25} color={isActive ? '#f97316' : 'white'} strokeWidth={1.5} />
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
    <div className="fixed inset-0" style={{ background: '#000' }}>
      <div style={{ '--bg-screen': '#000000', '--border-subtle': 'transparent' } as React.CSSProperties}>
        <AppHeader />
      </div>
      <Suspense>
        <EmberViewContent />
      </Suspense>
    </div>
  );
}
