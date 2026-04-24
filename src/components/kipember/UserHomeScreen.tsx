'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, ChevronLeft, ChevronRight, Star, Users } from 'lucide-react';
import AppHeader from '@/components/kipember/AppHeader';
import { getPreviewMediaUrl, type EmberMediaType } from '@/lib/media';

function EmberMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="white">
      <circle cx="36" cy="36" r="7.2" fill="#f97316" />
      <rect x="32.4" y="3.18" width="7.2" height="21.6" rx="3.6" ry="3.6" />
      <rect x="32.4" y="47.22" width="7.2" height="21.6" rx="3.6" ry="3.6" />
      <rect x="10.38" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-22.02 49.98) rotate(-90)" />
      <rect x="54.42" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(22.02 94.02) rotate(-90)" />
      <rect x="47.97" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(29.55 -30.48) rotate(45)" />
      <rect x="16.83" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(42.45 .66) rotate(45)" />
      <rect x="16.83" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-8.46 20.43) rotate(-45)" />
      <rect x="47.97" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-21.36 51.57) rotate(-45)" />
    </svg>
  );
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function relativeTime(value: Date | string): string {
  const then = typeof value === 'string' ? new Date(value) : value;
  const diffMs = Date.now() - then.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.round(days / 365);
  return `${years}y ago`;
}


// ─── SwipeDismiss ─────────────────────────────────────────────────────────────

function SwipeDismiss({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) {
  const [dragX, setDragX] = useState(0);
  const [settling, setSettling] = useState(false);
  const [gone, setGone] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);

  const THRESHOLD = 80;

  function handlePointerDown(e: React.PointerEvent) {
    startPos.current = { x: e.clientX, y: e.clientY };
    swiping.current = false;
    setSettling(false);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!startPos.current) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    if (!swiping.current) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        swiping.current = true;
        try { cardRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
      } else return;
    }
    setDragX(dx);
  }

  function handlePointerUp() {
    if (!startPos.current) return;
    const wasSwipe = swiping.current;
    const dx = dragX;
    startPos.current = null;
    swiping.current = false;
    if (!wasSwipe) return;
    setSettling(true);
    if (Math.abs(dx) >= THRESHOLD) {
      setDragX(dx > 0 ? window.innerWidth : -window.innerWidth);
      setTimeout(() => { setGone(true); onDismiss(); }, 260);
    } else {
      setDragX(0);
      setTimeout(() => setSettling(false), 300);
    }
  }

  if (gone) return null;

  const pct = Math.min(1, Math.abs(dragX) / THRESHOLD);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Dismiss bg */}
      <div
        className="absolute inset-0 flex items-center rounded-2xl"
        style={{
          background: '#1f2937',
          opacity: pct,
          justifyContent: dragX > 0 ? 'flex-start' : 'flex-end',
          paddingLeft: dragX > 0 ? 20 : 0,
          paddingRight: dragX <= 0 ? 20 : 0,
        }}
      >
        <span className="text-white/50 text-sm font-medium">Dismiss</span>
      </div>
      {/* Card */}
      <div
        ref={cardRef}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: settling ? 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
          touchAction: 'pan-y',
          cursor: 'grab',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Facepile ─────────────────────────────────────────────────────────────────

const DUMMY_CONTRIBUTORS: Array<{ initials: string; color: string; name: string; joined: string; avatarUrl?: string }> = [
  { initials: 'SA', color: '#7c3aed', name: 'Sarah',  joined: 'Today' },
  { initials: 'MK', color: '#0891b2', name: 'Mike',   joined: 'Today' },
  { initials: 'JL', color: '#16a34a', name: 'James',  joined: 'Yesterday' },
  { initials: 'RB', color: '#b45309', name: 'Rachel', joined: '3d ago' },
];

function Facepile({
  people,
  max = 3,
  size = 30,
  overlap = 10,
}: {
  people: Array<{ initials: string; color: string; avatarUrl?: string }>;
  max?: number;
  size?: number;
  overlap?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const step = size - overlap;
  const totalW = size + (shown.length - 1 + (extra > 0 ? 1 : 0)) * step;

  return (
    <div className="relative flex-shrink-0 flex items-center" style={{ width: totalW, height: 55 }}>
      {shown.map((p, i) => (
        <div
          key={i}
          className="absolute flex items-center justify-center rounded-full text-white font-bold overflow-hidden"
          style={{
            width: size,
            height: size,
            left: i * step,
            background: p.color,
            zIndex: shown.length - i,
            fontSize: Math.round(size * 0.32),
          }}
        >
          {p.avatarUrl
            ? <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
            : p.initials}
        </div>
      ))}
      {extra > 0 && (
        <div
          className="absolute flex items-center justify-center rounded-full font-bold"
          style={{
            width: size,
            height: size,
            left: shown.length * step,
            background: 'var(--bg-surface)',
            color: 'rgba(255,255,255,0.45)',
            fontSize: Math.round(size * 0.3),
            zIndex: 0,
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

type Step = 'home' | 'confirm' | 'processing';

const CONTRIBUTOR_COLORS = ['#7c3aed', '#0891b2', '#16a34a', '#b45309', '#db2777', '#2563eb', '#d97706', '#9333ea'];

function colorForKey(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return CONTRIBUTOR_COLORS[hash % CONTRIBUTOR_COLORS.length];
}

function relativeJoined(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThat = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfThat) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

type ContributorCard = {
  key: string;
  contributorId: string;
  emberId: string;
  name: string;
  avatarUrl: string | null;
  joinedAt: Date | string;
};

type HomeActivityItemProp = {
  emberId: string;
  emberTitle: string | null;
  thumb: { mediaType: string; filename: string; posterFilename: string | null };
  count: number;
  at: Date | string;
  faces?: Array<{ key: string; name: string; initials: string; color: string; avatarUrl: string | null }>;
};

export default function UserHomeScreen({
  initialProfile,
  initialImages,
  initialAvatarUrl,
  initialTotalContributors,
  initialContributors,
  initialHomeActivity,
}: {
  initialProfile: { name: string | null; email: string } | null;
  initialImages?: Array<{
    accessType: string;
    filename: string;
    mediaType: EmberMediaType;
    posterFilename: string | null;
  }>;
  initialAvatarUrl?: string | null;
  initialTotalContributors?: number;
  initialContributors?: ContributorCard[];
  initialHomeActivity?: {
    contributions: { items: HomeActivityItemProp[] };
    wikiUpdates:   { items: HomeActivityItemProp[] };
    guestViews:    { items: HomeActivityItemProp[] };
  };
}) {
  const totalEmbers = initialImages?.filter((img) => img.accessType === 'owner').length ?? 0;
  const totalContributors = initialTotalContributors ?? 0;
  const contributors = initialContributors ?? [];
  const activityImages = (initialImages ?? []).slice(0, 3).map((img) =>
    getPreviewMediaUrl({
      mediaType: img.mediaType,
      filename: img.filename,
      posterFilename: img.posterFilename,
    })
  );

  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<Step>('home');
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [createdImageId, setCreatedImageId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null);
  const [dismissedActivity, setDismissedActivity] = useState<Set<string>>(new Set());

  const displayName = initialProfile?.name || initialProfile?.email || 'Ember User';

  function handleFile(file: File) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadError('');
    setStep('confirm');
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find(
        (i) => i.kind === 'file' && (i.type.startsWith('image/') || i.type.startsWith('video/'))
      );
      const file = item?.getAsFile();
      if (file) handleFile(file);
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!createdImageId || step !== 'processing') return;
    const timer = setTimeout(() => {
      router.replace(`/ember/${createdImageId}?ember=owner`);
    }, 400);
    return () => clearTimeout(timer);
  }, [createdImageId, step, router]);

  useEffect(() => {
    void fetch('/api/profile', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return;
        const payload = await res.json();
        if (typeof payload?.user?.avatarUrl === 'string') {
          setAvatarUrl(payload.user.avatarUrl);
        }
      })
      .catch(() => undefined);
  }, []);

  async function handleCreate() {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError('');
    setCreatedImageId(null);
    setStep('processing');
    const formData = new FormData();
    formData.append('file', selectedFile);
    try {
      const response = await fetch('/api/images', { method: 'POST', body: formData });
      const payload = await response.json().catch(() => ({})) as { id?: string; error?: string };
      if (!response.ok || typeof payload?.id !== 'string') {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to create ember');
      }
      setCreatedImageId(payload.id);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to create ember');
      setStep('confirm');
    } finally {
      setUploading(false);
    }
  }

  if (step === 'confirm' && previewUrl) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg-screen)', paddingTop: 56 }}>
        <AppHeader avatarUrl={avatarUrl} userInitials={initials(displayName)} userModalHref="/account" />
        <div className="absolute top-4 left-4" style={{ top: 64 }}>
          <button
            type="button"
            onClick={() => setStep('home')}
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <ChevronLeft size={22} color="var(--text-primary)" strokeWidth={1.8} />
          </button>
        </div>
        <div className="w-full rounded-2xl overflow-hidden" style={{ maxWidth: 420, border: '1px solid var(--border-default)' }}>
          <img src={previewUrl} alt="Selected photo" className="w-full h-auto block" />
        </div>
        <div className="w-full flex flex-col gap-5 mt-7" style={{ maxWidth: 420 }}>
          <p className="text-white font-medium text-base text-center leading-snug">Create an ember from this photo?</p>
          {uploadError ? <p className="text-sm text-center text-red-300">{uploadError}</p> : null}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('home')}
              className="flex-1 flex items-center justify-center rounded-full text-sm font-medium can-hover-dim"
              style={{ minHeight: 44, background: 'transparent', border: '1.5px solid var(--border-btn)' }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="flex-1 flex items-center justify-center rounded-full text-sm font-medium text-white can-hover-dim"
              style={{ minHeight: 44, background: '#f97316' }}
            >
              Create Ember
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-8" style={{ background: 'var(--bg-screen)', paddingTop: 56 }}>
        <AppHeader avatarUrl={avatarUrl} userInitials={initials(displayName)} userModalHref="/account" />
        <style>{'@keyframes kipSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
        <div className="rounded-full flex items-center justify-center" style={{ width: 96, height: 96, background: 'rgba(249,115,22,0.15)', border: '1.5px solid rgba(249,115,22,0.55)', animation: 'kipSpin 1.5s linear infinite' }}>
          <EmberMark size={40} />
        </div>
        <p className="mt-8 font-medium text-base text-white">
          {createdImageId ? 'Ember created!' : 'Igniting ember'}
        </p>
        <p className="mt-1 text-sm text-white/60">
          {uploadError || (createdImageId ? 'Opening your memory...' : 'Building the ember structure')}
        </p>
      </div>
    );
  }

  const firstName = (displayName || '').split(/\s+/)[0] ?? displayName;

  return (
    <div
      className="fixed inset-0"
      style={{ background: 'var(--bg-screen)', paddingTop: 56 }}
    >
      <AppHeader
        avatarUrl={avatarUrl}
        userInitials={initials(displayName)}
        userModalHref="/account"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      {/* Scrollable content */}
      <div
        className="absolute left-0 right-0 bottom-0 overflow-y-auto no-scrollbar flex flex-col items-center px-4"
        style={{ top: 56 }}
      >
      <div className="w-full max-w-xl">
        {/* a) Greeting */}
        <div className="pt-5 pb-2">
          <h1 className="text-white text-2xl font-bold tracking-tight">Hello {firstName}</h1>
          <p className="text-white/60 text-sm mt-1">Good to see you again!</p>
        </div>

        {/* b) Create ember card */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 px-3 rounded-2xl cursor-pointer can-hover-card"
            style={{
              height: 72,
              background: isDragOver ? 'rgba(249,115,22,0.08)' : 'var(--bg-surface)',
              border: `1px solid ${isDragOver ? '#f97316' : 'var(--border-subtle)'}`,
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
          >
            <div
              className="flex-shrink-0 rounded-xl flex items-center justify-center"
              style={{
                width: 48,
                height: 48,
                background: '#f97316',
                border: 'none',
              }}
            >
              <EmberMark size={22} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-white text-sm font-medium leading-snug">Create a new ember</p>
              <p className="text-xs leading-snug mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Drop, paste, or choose a photo
              </p>
            </div>
            <ChevronRight size={15} strokeWidth={2} className="flex-shrink-0 mr-1" style={{ color: 'rgba(255,255,255,0.2)' }} />
          </button>
        </div>

        {/* Stats strip */}
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-3">
            <Star size={18} strokeWidth={2} color="white" />
            <p className="text-base font-bold text-white">Your Stats</p>
          </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: String(totalEmbers),       label: 'Embers' },
            { value: String(totalContributors), label: 'Contributors' },
            { value: '340',                     label: 'Story Score' },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl"
              style={{ height: 72, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <span className="text-white font-bold text-xl leading-none">{value}</span>
              <span className="text-xs leading-none" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
            </div>
          ))}
        </div>
        </div>

        {/* c) Ember activity */}
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={18} strokeWidth={2} color="white" />
            <p className="text-base font-bold text-white">Ember Activity</p>
          </div>
          <div className="flex flex-col gap-2">

            {(initialHomeActivity?.contributions.items ?? []).map((item) => {
              const dismissKey = `contributions:${item.emberId}`;
              if (dismissedActivity.has(dismissKey)) return null;
              return (
                <SwipeDismiss
                  key={dismissKey}
                  onDismiss={() => {
                    setDismissedActivity(p => new Set([...p, dismissKey]));
                    fetch('/api/home/mark-seen', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ kind: 'contributions', at: new Date(item.at).toISOString() }),
                    }).catch(() => {});
                  }}
                >
                  <Link
                    href={`/ember/${item.emberId}`}
                    draggable={false}
                    className="flex items-center gap-3 px-3 rounded-2xl can-hover-card"
                    style={{ height: 72, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' }}>
                      <img
                        src={getPreviewMediaUrl({
                          mediaType: item.thumb.mediaType as EmberMediaType,
                          filename: item.thumb.filename,
                          posterFilename: item.thumb.posterFilename,
                        })}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        <span style={{ color: '#f97316', fontWeight: 700 }}>{item.count}</span>{' '}
                        {item.count === 1 ? 'Contribution' : 'Contributions'}
                      </p>
                      <p className="text-xs leading-snug mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {item.emberTitle || 'Untitled'} · {relativeTime(item.at)}
                      </p>
                    </div>
                    {item.faces && item.faces.length > 0 && (
                      <Facepile people={item.faces} size={36} overlap={11} />
                    )}
                  </Link>
                </SwipeDismiss>
              );
            })}

            {(initialHomeActivity?.wikiUpdates.items ?? []).map((item) => {
              const dismissKey = `wiki:${item.emberId}`;
              if (dismissedActivity.has(dismissKey)) return null;
              return (
                <SwipeDismiss
                  key={dismissKey}
                  onDismiss={() => {
                    setDismissedActivity(p => new Set([...p, dismissKey]));
                    fetch('/api/home/mark-seen', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ kind: 'wiki', at: new Date(item.at).toISOString() }),
                    }).catch(() => {});
                  }}
                >
                  <Link
                    href={`/ember/${item.emberId}`}
                    draggable={false}
                    className="flex items-center gap-3 px-3 rounded-2xl can-hover-card"
                    style={{ height: 72, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)' }}>
                      <img
                        src={getPreviewMediaUrl({
                          mediaType: item.thumb.mediaType as EmberMediaType,
                          filename: item.thumb.filename,
                          posterFilename: item.thumb.posterFilename,
                        })}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        <span style={{ color: '#f97316', fontWeight: 700 }}>{item.count}</span>{' '}
                        {item.count === 1 ? 'Wiki Update' : 'Wiki Updates'}
                      </p>
                      <p className="text-xs leading-snug mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {item.emberTitle || 'Untitled'} · {relativeTime(item.at)}
                      </p>
                    </div>
                  </Link>
                </SwipeDismiss>
              );
            })}

            {(initialHomeActivity?.guestViews.items ?? []).map((item) => {
              const dismissKey = `guestViews:${item.emberId}`;
              if (dismissedActivity.has(dismissKey)) return null;
              return (
                <SwipeDismiss
                  key={dismissKey}
                  onDismiss={() => {
                    setDismissedActivity(p => new Set([...p, dismissKey]));
                    fetch('/api/home/mark-seen', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ kind: 'guestViews', at: new Date(item.at).toISOString() }),
                    }).catch(() => {});
                  }}
                >
                  <Link
                    href={`/ember/${item.emberId}`}
                    draggable={false}
                    className="flex items-center gap-3 px-3 rounded-2xl can-hover-card"
                    style={{ height: 72, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #059669 0%, #065f46 100%)' }}>
                      <img
                        src={getPreviewMediaUrl({
                          mediaType: item.thumb.mediaType as EmberMediaType,
                          filename: item.thumb.filename,
                          posterFilename: item.thumb.posterFilename,
                        })}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        <span style={{ color: '#f97316', fontWeight: 700 }}>{item.count}</span>{' '}
                        {item.count === 1 ? 'Guest View' : 'Guest Views'}
                      </p>
                      <p className="text-xs leading-snug mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {item.emberTitle || 'Untitled'} · {relativeTime(item.at)}
                      </p>
                    </div>
                  </Link>
                </SwipeDismiss>
              );
            })}

          </div>
        </div>

        {/* d) New members */}
        <div className="mt-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Users size={18} strokeWidth={2} color="white" />
            <p className="text-base font-bold text-white">Contributors</p>
            {contributors.length > 4 ? (
              <Link
                href="/account"
                className="ml-auto text-xs font-medium can-hover"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                View all →
              </Link>
            ) : null}
          </div>
          {contributors.length === 0 ? (
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              No contributors yet.
            </p>
          ) : (
            <div className="flex gap-3 -mx-4 px-4">
              {contributors.slice(0, 4).map((person) => (
                <Link
                  key={person.key}
                  href={`/tend/contributors?id=${person.emberId}&view=${person.contributorId}&from=home`}
                  className="flex flex-col items-center gap-2 flex-shrink-0 can-hover"
                  style={{ width: 60 }}
                >
                  <div
                    className="rounded-full flex items-center justify-center text-white font-bold overflow-hidden"
                    style={{
                      width: 44,
                      height: 44,
                      background: colorForKey(person.key),
                      fontSize: 13,
                    }}
                  >
                    {person.avatarUrl
                      ? <img src={person.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      : initials(person.name)}
                  </div>
                  <p className="text-sm text-white font-medium text-center truncate w-full">{person.name.split(/\s+/)[0] || person.name}</p>
                  <p className="text-[10px] text-center truncate w-full" style={{ color: 'rgba(255,255,255,0.25)', marginTop: -4 }}>{relativeJoined(person.joinedAt)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
      </div>
    </div>
  );
}
