'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Flame, Leaf, MessageCirclePlus, Share } from 'lucide-react';
import { getPreviewMediaUrl } from '@/lib/media';
import AppHeader from '@/components/kipember/AppHeader';

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
const CARD_H = '60vh';
const PANEL_SM_H = '20vh';

const railItems = [
  { label: 'ember', icon: MessageCirclePlus },
  { label: 'stories', icon: Flame },
  { label: 'tend', icon: Leaf },
  { label: 'share', icon: Share },
] as const;

function TestLayoutContent() {
  const params = useSearchParams();
  const id = params.get('id');
  const [ember, setEmber] = useState<EmberSummary | null>(null);
  const [emberOpen, setEmberOpen] = useState(false);
  const [activeRail, setActiveRail] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'square' | null>(null);
  const [naturalRatio, setNaturalRatio] = useState<string | null>(null);
  const [titleDateH, setTitleDateH] = useState(0);
  const titleDateRef = useRef<HTMLDivElement>(null);

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setNaturalRatio(`${w}/${h}`);
    if (w === h) setOrientation('square');
    else if (w > h) setOrientation('landscape');
    else setOrientation('portrait');
  }

  const aspectRatio = naturalRatio ?? (orientation === 'portrait' ? '3/4' : orientation === 'landscape' ? '4/3' : '1/1');
  const objectPosition = orientation === 'portrait' ? 'center top' : 'center';

  useEffect(() => {
    if (!titleDateRef.current) return;
    const observer = new ResizeObserver(() => {
      setTitleDateH(titleDateRef.current?.offsetHeight ?? 0);
    });
    observer.observe(titleDateRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!id) return;
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

  return (
    <>
      {/* Main area: flex col, photo fills remaining space above spacer */}
      <div className="fixed inset-0 flex flex-col" style={{ paddingTop: 56 }}>
        {/* Title + date — full width, right-aligned; tapping closes tend */}
        <div
          ref={titleDateRef}
          className="px-[10px] flex-shrink-0"
          onClick={() => { if (activeRail === 'tend') setActiveRail(null); }}
          style={{ cursor: activeRail === 'tend' ? 'pointer' : undefined }}
        >
          {ember?.title ? (
            <p className="text-white font-semibold text-right" style={{ fontSize: 16 }}>{ember.title}</p>
          ) : null}
          {ember?.createdAt ? (
            <p className="mb-2 text-right" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              {new Date(ember.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          ) : null}
        </div>

        {/* Photo — centered, scales to fill remaining height */}
        <div className="flex-1 min-h-0 px-[10px] pb-3 flex items-start justify-center overflow-hidden">
          {photoUrl ? (
            <div
              className="rounded-2xl overflow-hidden cursor-pointer"
              style={{
                border: '1px solid var(--border-default)',
                aspectRatio: naturalRatio ?? undefined,
                ...(orientation === 'portrait'
                  ? { height: '100%', maxWidth: '100%' }
                  : { width: '100%', maxHeight: '100%' }),
              }}
              onClick={() => { setEmberOpen(false); setActiveRail(null); }}
            >
              <img
                src={photoUrl}
                alt=""
                className="w-full h-full"
                style={{ objectFit: 'cover', objectPosition, display: 'block' }}
                onLoad={handleImageLoad}
              />
            </div>
          ) : (
            <div className="rounded-2xl flex items-center justify-center" style={{ height: 200, background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>loading…</span>
            </div>
          )}
        </div>

        {/* Spacer — grows when card opens, shrinking the photo */}
        <div
          style={{
            flexShrink: 0,
            height: emberOpen ? CARD_H : RAIL_H,
            transition: 'height 320ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>

      {/* Ember card — slides up full width */}
      <div
        className="fixed bottom-0 left-0 right-0 z-10"
        style={{
          height: CARD_H,
          background: '#1c1c1e',
          borderRadius: '20px 20px 0 0',
          transform: emberOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* Stories panel — 20% from bottom, below rail */}
      <div
        className="fixed bottom-0 left-0 right-0 z-10"
        style={{
          height: PANEL_SM_H,
          background: '#1c1c1e',
          borderRadius: '20px 20px 0 0',
          transform: activeRail === 'stories' ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* Share panel — 20% from bottom, below rail */}
      <div
        className="fixed bottom-0 left-0 right-0 z-10"
        style={{
          height: PANEL_SM_H,
          background: '#1c1c1e',
          borderRadius: '20px 20px 0 0',
          transform: activeRail === 'share' ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* Tend panel — below title+date, above everything */}
      <div
        className="fixed left-0 right-0 bottom-0 z-30"
        style={{
          top: 56 + titleDateH,
          background: '#1c1c1e',
          borderRadius: '20px 20px 0 0',
          transform: activeRail === 'tend' ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* Rail — fixed bottom, above all panels including tend */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center gap-8 px-4 py-4">
        {railItems.map(({ label, icon: Icon }) => {
          const isActive = label === 'ember' ? emberOpen : activeRail === label;
          const isDimmed = activeRail !== null || emberOpen ? !isActive : false;
          return (
            <button
              key={label}
              className="flex flex-col items-center gap-1 cursor-pointer transition-opacity duration-200"
              style={{ minWidth: 44, opacity: isDimmed ? 0.25 : 1 }}
              onClick={() => {
                if (label === 'ember') {
                  setEmberOpen((o) => !o);
                  setActiveRail(null);
                } else {
                  setEmberOpen(false);
                  setActiveRail((prev) => prev === label ? null : label);
                }
              }}
            >
              <Icon size={32} color={isActive ? '#f97316' : 'white'} strokeWidth={1.5} />
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
