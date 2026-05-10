'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Flame, Leaf, MessageCirclePlus, Share, X } from 'lucide-react';
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

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setNaturalRatio(`${w}/${h}`);
    if (w === h) setOrientation('square');
    else if (w > h) setOrientation('landscape');
    else setOrientation('portrait');
  }

  const objectPosition = orientation === 'portrait' ? 'center top' : 'center';

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
        {/* Photo — centered, scales to fill remaining height */}
        <div className="flex-1 min-h-0 px-[10px] pb-3 flex items-start justify-center overflow-hidden">
          {photoUrl ? (
            <div
              className="rounded-2xl overflow-hidden cursor-pointer relative"
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
              {/* Title + date overlay — top right */}
              {(ember?.title || ember?.createdAt) ? (
                <div className="absolute top-0 right-0 p-3 text-right">
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

        {/* Spacer — grows when card opens, shrinking the photo */}
        <div
          style={{
            flexShrink: 0,
            height: emberOpen ? CARD_H : (activeRail === 'stories' || activeRail === 'share') ? PANEL_SM_H : RAIL_H,
            transition: 'height 320ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>

      {/* Ember card — slides up full width */}
      <div
        className="fixed bottom-0 left-0 right-0 z-10 flex flex-col"
        style={{
          height: CARD_H,
          background: '#111113',
          borderRadius: '20px 20px 0 0',
          transform: emberOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="flex justify-end px-4 pt-4">
          <button className="cursor-pointer" onClick={() => setEmberOpen(false)}>
            <X size={20} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Stories panel — 20% from bottom, below rail */}
      <div
        className="fixed bottom-0 left-0 right-0 z-10 flex flex-col"
        style={{
          height: PANEL_SM_H,
          background: '#111113',
          borderRadius: '20px 20px 0 0',
          transform: activeRail === 'stories' ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="flex justify-end px-4 pt-4">
          <button className="cursor-pointer" onClick={() => setActiveRail(null)}>
            <X size={20} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Share panel — 20% from bottom, below rail */}
      <div
        className="fixed bottom-0 left-0 right-0 z-10 flex flex-col"
        style={{
          height: PANEL_SM_H,
          background: '#111113',
          borderRadius: '20px 20px 0 0',
          transform: activeRail === 'share' ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="flex justify-end px-4 pt-4">
          <button className="cursor-pointer" onClick={() => setActiveRail(null)}>
            <X size={20} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Tend panel — starts just below header */}
      <div
        className="fixed left-0 right-0 bottom-0 z-30 flex flex-col"
        style={{
          top: 56,
          background: '#111113',
          borderRadius: '20px 20px 0 0',
          transform: activeRail === 'tend' ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="flex justify-end px-4 pt-4">
          <button className="cursor-pointer" onClick={() => setActiveRail(null)}>
            <X size={20} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
          </button>
        </div>
      </div>

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
