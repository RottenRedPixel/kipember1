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
      <div className="w-full max-w-xl mx-auto px-4" style={{ paddingTop: 56 }}>
        {ember?.title ? (
          <p className="text-white font-semibold text-lg mb-0.5">{ember.title}</p>
        ) : null}
        {ember?.createdAt ? (
          <p className="mb-2" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            {new Date(ember.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        ) : null}
        {photoUrl ? (
          <div className="rounded-2xl overflow-hidden cursor-pointer" style={{ border: '1px solid var(--border-default)' }} onClick={() => router.back()}>
            <img src={photoUrl} alt="" className="w-full block" />
          </div>
        ) : (
          <div className="rounded-2xl flex items-center justify-center" style={{ height: 200, background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>loading…</span>
          </div>
        )}
      </div>
      <div className="fixed bottom-0 left-0 right-0 flex justify-center gap-8 px-4 py-4">
        {railItems.map(({ label, icon: Icon }) => (
          <button key={label} className="flex flex-col items-center gap-1 cursor-pointer" style={{ minWidth: 44 }}>
            <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <Icon size={20} color="rgba(255,255,255,0.6)" strokeWidth={1.8} />
            </div>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export default function TestLayoutPage() {
  return (
    <div className="fixed inset-0 overflow-y-auto no-scrollbar" style={{ background: '#000' }}>
      <div style={{ '--bg-screen': '#000000', '--border-subtle': 'transparent' } as React.CSSProperties}>
        <AppHeader />
      </div>
      <Suspense>
        <TestLayoutContent />
      </Suspense>
    </div>
  );
}
