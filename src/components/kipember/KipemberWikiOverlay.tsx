'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Leaf, X } from 'lucide-react';
import KipemberWikiContent, {
  type KipemberWikiDetail,
} from '@/components/kipember/KipemberWikiContent';

// Wiki overlay — renders inside /ember/[id]?m=wiki so the ember view
// stays mounted underneath. Visually mirrors the legacy slider (93%
// width with an 8% peek tap-back to the ember view), but because it's
// rendered as a modal layer, the cover photo + right rail remain
// visible behind instead of getting replaced by a route change.
//
// Animation: slides in from the right on open and slides BACK out to
// the right on close (peek tap or X). The dismiss is intercepted —
// instead of navigating immediately, we run the slide-out transition
// first and then push to closeHref.
export default function KipemberWikiOverlay({
  imageId,
  closeHref,
}: {
  imageId: string | null;
  closeHref: string;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<KipemberWikiDetail | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  useEffect(() => {
    if (!statusMessage) return;
    const t = setTimeout(() => setStatusMessage(''), 3000);
    return () => clearTimeout(t);
  }, [statusMessage]);
  // Visual open state — drives the inline transform transition. Mounts
  // at false (off-screen right), flips to true on next animation frame
  // so the browser commits the off-screen state before transitioning.
  const [overlayOpen, setOverlayOpen] = useState(false);

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

  // Trigger the slide-in transition on mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setOverlayOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = useCallback(() => {
    setOverlayOpen(false);
    setTimeout(() => {
      router.push(closeHref);
    }, 300);
  }, [closeHref, router]);

  return (
    <div className="absolute inset-0 z-40 flex justify-center">
      <div className="relative w-full max-w-xl h-full flex">
        <button
          type="button"
          onClick={handleClose}
          className="w-[8%] h-full"
          style={{ cursor: 'pointer' }}
          aria-label="Back to ember view"
        />
        <div
          className="flex-1 h-full flex flex-col"
          style={{
            background: 'color-mix(in srgb, var(--bg-screen) 98%, transparent)',
            borderLeft: '1px solid var(--border-subtle)',
            transform: overlayOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div
            className="flex items-center gap-3 px-4 flex-shrink-0"
            style={{ height: 56, borderBottom: '1px solid var(--border-subtle)' }}
          >
            <Leaf size={22} color="var(--text-primary)" strokeWidth={1.6} className="flex-shrink-0" />
            <h2 className="flex-1 text-white font-medium text-base">Tend this Ember</h2>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close wiki"
              className="w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-full can-hover"
              style={{ opacity: 0.75, cursor: 'pointer' }}
            >
              <X size={20} color="var(--text-primary)" strokeWidth={1.8} />
            </button>
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
