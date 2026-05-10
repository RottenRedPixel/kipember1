'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Flame, Leaf, MessageCirclePlus, Share2 } from 'lucide-react';
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

const railItems = [
  { label: 'ember', icon: MessageCirclePlus },
  { label: 'stories', icon: Flame },
  { label: 'tend', icon: Leaf },
  { label: 'share', icon: Share2 },
] as const;

function TestLayoutContent() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('id');
  const [ember, setEmber] = useState<EmberSummary | null>(null);
  const [emberOpen, setEmberOpen] = useState(false);

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
        {/* Title + date */}
        <div className="px-4 flex-shrink-0">
          {ember?.title ? (
            <p className="text-white font-semibold text-lg mb-0.5">{ember.title}</p>
          ) : null}
          {ember?.createdAt ? (
            <p className="mb-2" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              {new Date(ember.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          ) : null}
        </div>

        {/* Photo — flex-1, shrinks as spacer grows */}
        <div className="flex-1 min-h-0 px-4 overflow-hidden">
          {photoUrl ? (
            <div
              className="rounded-2xl overflow-hidden cursor-pointer h-full"
              style={{ border: '1px solid var(--border-default)' }}
              onClick={() => router.back()}
            >
              <img src={photoUrl} alt="" className="w-full h-full" style={{ objectFit: 'contain' }} />
            </div>
          ) : (
            <div className="rounded-2xl flex items-center justify-center h-full" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>loading…</span>
            </div>
          )}
        </div>

        {/* Bottom spacer — grows when card opens, shrinking the photo */}
        <div
          style={{
            flexShrink: 0,
            height: emberOpen ? CARD_H : RAIL_H,
            transition: 'height 320ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>

      {/* Ember card — slides up from bottom, same width as photo */}
      <div
        className="fixed bottom-0 z-10"
        style={{
          height: CARD_H,
          background: '#1c1c1e',
          borderRadius: '20px 20px 0 0',
          left: '50%',
          width: 'min(calc(100% - 32px), 576px)',
          transform: emberOpen ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* Rail — fixed bottom, above card */}
      <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-center gap-8 px-4 py-4">
        {railItems.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className="flex flex-col items-center gap-1 cursor-pointer"
            style={{ minWidth: 44 }}
            onClick={label === 'ember' ? () => setEmberOpen((o) => !o) : undefined}
          >
            <Icon size={32} color={label === 'ember' && emberOpen ? '#f97316' : 'white'} strokeWidth={1.5} />
            <span style={{ color: label === 'ember' && emberOpen ? '#f97316' : 'rgba(255,255,255,0.5)', fontSize: 11 }}>{label}</span>
          </button>
        ))}
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
