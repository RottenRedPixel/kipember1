'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';
import KipemberWikiContent, {
  type KipemberWikiDetail,
} from '@/components/kipember/KipemberWikiContent';

// Wiki overlay — renders inside /ember/[id]?m=wiki so the ember view
// stays mounted underneath. Visually mirrors the legacy slider (93%
// width with a 7% peek tap-back to the ember view), but because it's
// rendered as a modal layer, the cover photo + right rail remain
// visible behind instead of getting replaced by a route change.
export default function KipemberWikiOverlay({
  imageId,
  closeHref,
}: {
  imageId: string | null;
  closeHref: string;
}) {
  const [detail, setDetail] = useState<KipemberWikiDetail | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const refreshDetail = useCallback(async () => {
    if (!imageId) return;
    try {
      const response = await fetch(`/api/images/${imageId}`, { cache: 'no-store' });
      if (!response.ok) return;
      const payload = (await response.json()) as KipemberWikiDetail;
      setDetail(payload);
    } catch {
      // Silently keep the previous detail — the wiki UI tolerates a
      // stale snapshot better than flashing an error toast.
    }
  }, [imageId]);

  useEffect(() => {
    if (!imageId) return;
    void refreshDetail();
  }, [imageId, refreshDetail]);

  return (
    <div className="absolute inset-0 z-40 flex justify-center">
      <div className="relative w-full max-w-xl h-full flex">
        <Link href={closeHref} className="w-[8%] h-full" aria-label="Back to ember view" />
        <div
          className="flex-1 h-full flex flex-col slide-in-right"
          style={{
            background: 'color-mix(in srgb, var(--bg-screen) 97%, transparent)',
            borderLeft: '1px solid var(--border-subtle)',
          }}
        >
          <div
            className="flex items-center gap-3 px-4 flex-shrink-0"
            style={{ height: 56, borderBottom: '1px solid var(--border-subtle)' }}
          >
            <Leaf size={22} color="var(--text-primary)" strokeWidth={1.6} className="flex-shrink-0" />
            <h2 className="text-white font-medium text-base">Tend this Ember</h2>
          </div>

          <div className="flex-1 px-5 min-h-0 flex flex-col overflow-y-auto no-scrollbar py-4 gap-4">
            <KipemberWikiContent
              detail={detail}
              refreshDetail={refreshDetail}
              onStatus={setStatusMessage}
            />
          </div>

          {statusMessage ? (
            <div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm text-white"
              style={{
                background: 'rgba(34,197,94,0.9)',
                pointerEvents: 'none',
              }}
            >
              {statusMessage}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
