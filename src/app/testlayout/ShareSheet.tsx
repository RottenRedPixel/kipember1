'use client';

import { useEffect, useState, useCallback } from 'react';
import { Copy, Link2, MessageCircle, MoreHorizontal, Share } from 'lucide-react';

const SHEET_H = '30vh';
const SNAP_MS = 320;

function FacebookIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export default function ShareSheet({ isOpen, onClose, emberId }: { isOpen: boolean; onClose: () => void; emberId: string | null }) {
  const [showing, setShowing] = useState(isOpen);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  useEffect(() => { if (isOpen) setShowing(true); else setShowing(false); }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !emberId) return;
    setShareToken(null);
    fetch(`/api/embers/${emberId}/share-token`, { method: 'POST' })
      .then((r) => r.json())
      .then((d) => { if (d.token) setShareToken(d.token); })
      .catch(() => {});
  }, [isOpen, emberId]);

  const shareUrl = shareToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${shareToken}` : null;

  const copyLink = useCallback(async () => {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); } catch { /* ignore */ }
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  }, [shareUrl]);

  function handleClose() {
    setShowing(false);
    setTimeout(onClose, SNAP_MS);
  }

  const btnClass = 'flex flex-col items-center gap-1 p-2 rounded-xl cursor-pointer';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-10 flex flex-col"
      style={{
        height: SHEET_H,
        background: '#111113',
        borderRadius: '20px 20px 0 0',
        transform: showing ? 'translateY(0)' : 'translateY(100%)',
        transition: `transform ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      <div className="flex justify-center pt-3 pb-1 flex-shrink-0" onClick={handleClose} style={{ cursor: 'pointer' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
      </div>
      <div className="flex items-center px-4 pt-3 pb-3 flex-shrink-0">
        <Share size={18} color="white" strokeWidth={1.8} />
        <span className="flex-1 ml-2 text-white font-semibold text-base">Share this Ember</span>
      </div>

      <div className="flex-1 flex items-end justify-around px-4 pb-2">
        <button type="button" className={btnClass} onClick={copyLink}>
          <div className="w-10 h-10 flex items-center justify-center">
            <Link2 size={22} color={copyStatus === 'copied' ? '#4ade80' : 'white'} strokeWidth={1.6} />
          </div>
          <span className="text-xs" style={{ color: copyStatus === 'copied' ? '#4ade80' : 'rgba(255,255,255,0.6)' }}>
            {copyStatus === 'copied' ? 'Copied!' : 'Copy Link'}
          </span>
        </button>

        <button type="button" className={btnClass} onClick={() => shareUrl ? window.location.assign(`sms:?&body=${encodeURIComponent(shareUrl)}`) : undefined}>
          <div className="w-10 h-10 flex items-center justify-center">
            <MessageCircle size={22} color="white" strokeWidth={1.6} />
          </div>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Message</span>
        </button>

        <a href={shareUrl ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` : undefined} className={btnClass} target="_blank" rel="noreferrer">
          <div className="w-10 h-10 flex items-center justify-center" style={{ color: 'white' }}>
            <FacebookIcon />
          </div>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Facebook</span>
        </a>

        <button type="button" className={btnClass} onClick={() => shareUrl ? navigator.share?.({ url: shareUrl }) : undefined}>
          <div className="w-10 h-10 flex items-center justify-center">
            <MoreHorizontal size={22} color="white" strokeWidth={1.6} />
          </div>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>More</span>
        </button>
      </div>

      {/* URL capsule */}
      <div className="px-4 flex-shrink-0">
        <div className="flex h-11 items-center gap-2 rounded-full px-4" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid transparent' }}>
          <span className="flex-1 text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {shareUrl ?? 'Generating link…'}
          </span>
          <button type="button" onClick={copyLink} disabled={!shareUrl} className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full cursor-pointer" style={{ opacity: shareUrl ? 1 : 0 }}>
            <Copy size={14} color="white" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Toast / error area — reserved space */}
      <div className="px-4 py-3 flex-shrink-0" />
    </div>
  );
}
