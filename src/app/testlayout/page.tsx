'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Flame, Hand, Leaf, MessageCirclePlus, Share } from 'lucide-react';
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
};

const RAIL_H = 80;
const CARD_H = '50vh';
const PANEL_SM_H = '20vh';
const SWIPE_THRESHOLD = 50;
const SNAP_MS = 260;

const railItems = [
  { label: 'hello', icon: Hand },
  { label: 'ember', icon: MessageCirclePlus },
  { label: 'stories', icon: Flame },
  { label: 'tend', icon: Leaf },
  { label: 'share', icon: Share },
] as const;

function TestLayoutContent() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('id');
  const [ember, setEmber] = useState<EmberSummary | null>(null);
  const [emberIds, setEmberIds] = useState<string[]>([]);
  const [emberOpen, setEmberOpen] = useState(false);
  const [activeRail, setActiveRail] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'square' | null>(null);
  const [naturalRatio, setNaturalRatio] = useState<string | null>(null);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [snapping, setSnapping] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; axis: 'h' | 'v' | null } | null>(null);
  const lastDirRef = useRef<1 | -1>(1);
  const panelOpen = emberOpen || activeRail !== null;

  const objectPosition = orientation === 'portrait' ? 'center top' : 'center';
  const currentIndex = id ? emberIds.indexOf(id) : -1;

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

  useEffect(() => {
    fetch('/api/embers')
      .then((r) => r.json())
      .then((data: EmberSummary[]) => setEmberIds(data.map((e) => e.id)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setPhotoLoaded(false);
    fetch(`/api/embers/${id}`)
      .then((r) => r.json())
      .then((data) => setEmber(data))
      .catch(() => {});
  }, [id]);

  const photoUrl = ember
    ? getPreviewMediaUrl({
        mediaType: ember.mediaType as 'IMAGE' | 'VIDEO',
        filename: ember.filename,
        posterFilename: ember.posterFilename,
      })
    : null;

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
    const targetIndex = dir < 0 ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= emberIds.length) { snapBack(); return; }

    lastDirRef.current = dir;
    setSnapping(true);
    setSwipeX(dir < 0 ? -window.innerWidth : window.innerWidth);
    setTimeout(() => router.replace(`/testlayout?id=${emberIds[targetIndex]}`), SNAP_MS);
  }

  function handlePointerCancel() {
    dragRef.current = null;
    snapBack();
  }

  const closePanel = () => setActiveRail(null);

  return (
    <>
      <div className="fixed inset-0 flex flex-col" style={{ paddingTop: 56 }}>
        <div className="flex-1 min-h-0 px-[10px] pb-3 flex items-start justify-center overflow-hidden">
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
                transform: `translateX(${swipeX}px)`,
                transition: snapping ? `transform ${SNAP_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)` : 'none',
                touchAction: 'pan-y',
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
              {!panelOpen && (ember?.title || ember?.createdAt) ? (
                <div className="absolute top-0 right-0 p-3 text-right" style={{ pointerEvents: 'none' }}>
                  {ember?.title ? (
                    <p className="font-semibold" style={{ fontSize: 15, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{ember.title}</p>
                  ) : null}
                  {ember?.createdAt ? (
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                      {new Date(ember.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl" style={{ width: '100%', aspectRatio: '1/1', background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} />
          )}
        </div>

        <div
          style={{
            flexShrink: 0,
            height: emberOpen ? CARD_H : activeRail === 'hello' ? '50vh' : activeRail === 'share' ? '30vh' : activeRail === 'stories' ? PANEL_SM_H : RAIL_H,
            transition: 'height 320ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>

      <EmberSheet isOpen={emberOpen} onClose={() => setEmberOpen(false)} />
      <HelloSheet isOpen={activeRail === 'hello'} onClose={closePanel} />
      <StoriesSheet isOpen={activeRail === 'stories'} onClose={closePanel} />
      <ShareSheet isOpen={activeRail === 'share'} onClose={closePanel} emberId={id} />
      <TendSheet isOpen={activeRail === 'tend'} onClose={closePanel} />

      {/* Rail */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-around px-4 py-4" style={{ background: '#111113' }}>
        {railItems.map(({ label, icon: Icon }) => {
          const isActive = label === 'ember' ? emberOpen : activeRail === label;
          const isDimmed = panelOpen ? !isActive : false;
          return (
            <button
              key={label}
              className="flex flex-col items-center gap-1 cursor-pointer transition-opacity duration-200"
              style={{ minWidth: 44, opacity: isDimmed ? 0.25 : 1 }}
              onClick={() => {
                if (label === 'ember') { setEmberOpen((o) => !o); setActiveRail(null); }
                else { setEmberOpen(false); setActiveRail((prev) => prev === label ? null : label); }
              }}
            >
              <Icon size={27} color={isActive ? '#f97316' : 'white'} strokeWidth={1.5} />
              <span style={{ color: isActive ? '#f97316' : 'rgba(255,255,255,0.5)', fontSize: 11 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function TestLayoutPage() {
  return (
    <div className="fixed inset-0" style={{ background: '#000' }}>
      <div style={{ '--bg-screen': '#000000', '--border-subtle': 'transparent' } as React.CSSProperties}>
        <AppHeader />
      </div>
      <Suspense>
        <TestLayoutContent />
      </Suspense>
    </div>
  );
}
