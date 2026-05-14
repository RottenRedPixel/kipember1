'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Leaf, X } from 'lucide-react';
import KipemberWikiContent, { type KipemberWikiDetail } from '@/components/kipember/KipemberWikiContent';
import { useToast } from '@/lib/toast';
import { useResetZoomOnOpen } from '@/lib/reset-zoom';

const SNAP_MS = 320;

export default function TendSheet({
  isOpen,
  onClose,
  emberId,
}: {
  isOpen: boolean;
  onClose: () => void;
  emberId: string | null;
}) {
  const [showing, setShowing] = useState(isOpen);
  const [detail, setDetail] = useState<KipemberWikiDetail | null>(null);
  const { toast } = useToast();
  useResetZoomOnOpen(isOpen);
  const loadedRef = useRef(false);

  const fetchDetail = useCallback(async () => {
    if (!emberId) return;
    try {
      const r = await fetch(`/api/embers/${encodeURIComponent(emberId)}`, { cache: 'no-store' });
      const d = await r.json();
      setDetail(d);
    } catch { /* silently ignore */ }
  }, [emberId]);

  useEffect(() => {
    if (!isOpen || !emberId || loadedRef.current) return;
    loadedRef.current = true;
    void fetchDetail();
  }, [isOpen, emberId, fetchDetail]);

  useEffect(() => {
    if (isOpen) {
      setShowing(true);
    } else {
      setShowing(false);
      loadedRef.current = false;
      setDetail(null);
    }
  }, [isOpen]);

  function handleClose() {
    setShowing(false);
    setTimeout(onClose, SNAP_MS);
  }

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-50 flex flex-col"
      style={{
        top: 0,
        background: 'var(--bg-sheets)',
        borderRadius: '20px 20px 0 0',
        transform: showing ? 'translateY(0)' : 'translateY(100%)',
        transition: `transform ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      {/* Header */}
      <div className="flex items-center px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-header)' }}>
        <Leaf size={18} color="white" strokeWidth={1.8} />
        <span className="flex-1 ml-2 text-white font-semibold text-base">Tend this Ember</span>
        <button type="button" className="cursor-pointer" onClick={handleClose}>
          <X size={20} color="var(--text-secondary)" strokeWidth={1.8} />
        </button>
      </div>

      {/* Wiki content */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-[10px]">
        <KipemberWikiContent
          detail={detail}
          refreshDetail={fetchDetail}
          onStatus={(msg) => toast(msg, { type: 'success' })}
        />
      </div>
    </div>
  );
}
