'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AppHeader from '@/components/kipember/AppHeader';
import { getPreviewMediaUrl } from '@/lib/media';

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

// ─── Types ────────────────────────────────────────────────────────────────────

type EmberSummary = {
  id: string;
  filename: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO';
  posterFilename: string | null;
  title: string | null;
  capturedAt: string | null;
  createdAt: string;
  accessType: 'owner' | 'contributor' | 'network';
  contributorCount: number;
};

type TaskCard = {
  id: string;
  type: 'create-ember' | 'add-title' | 'add-date' | 'add-contributors';
  emberId?: string;
  thumbnailSrc?: string;
  label: string;
  sub: string;
  href?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeDate(dateStr: string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function buildCards(embers: EmberSummary[]): TaskCard[] {
  const cards: TaskCard[] = [];
  const owned = embers.filter((e) => e.accessType === 'owner');

  // Untitled embers
  let titleCount = 0;
  for (const e of owned) {
    if (!e.title && titleCount < 3) {
      titleCount++;
      cards.push({
        id: `title-${e.id}`,
        type: 'add-title',
        emberId: e.id,
        thumbnailSrc: getPreviewMediaUrl({
          mediaType: e.mediaType,
          filename: e.filename,
          posterFilename: e.posterFilename,
        }),
        label: 'Give this ember a name',
        sub: `Added ${relativeDate(e.createdAt)}`,
        href: `/tend/edit-title?id=${e.id}`,
      });
    }
  }

  // Embers missing a date
  let dateCount = 0;
  for (const e of owned) {
    if (!e.capturedAt && dateCount < 3) {
      dateCount++;
      const name = e.title ? `"${e.title}"` : 'this memory';
      cards.push({
        id: `date-${e.id}`,
        type: 'add-date',
        emberId: e.id,
        thumbnailSrc: getPreviewMediaUrl({
          mediaType: e.mediaType,
          filename: e.filename,
          posterFilename: e.posterFilename,
        }),
        label: `When was ${name}?`,
        sub: 'Add a date to place it in time',
        href: `/tend/edit-time-place?id=${e.id}`,
      });
    }
  }

  // Embers with no contributors
  let contribCount = 0;
  for (const e of owned) {
    if (e.contributorCount === 0 && contribCount < 2) {
      contribCount++;
      const name = e.title ? `"${e.title}"` : 'this ember';
      cards.push({
        id: `contrib-${e.id}`,
        type: 'add-contributors',
        emberId: e.id,
        thumbnailSrc: getPreviewMediaUrl({
          mediaType: e.mediaType,
          filename: e.filename,
          posterFilename: e.posterFilename,
        }),
        label: `Who else remembers ${name}?`,
        sub: 'Invite contributors to add memories',
        href: `/tend/contributors?id=${e.id}`,
      });
    }
  }

  // Create ember always last
  cards.push({
    id: 'create-ember',
    type: 'create-ember',
    label: 'Create a new ember',
    sub: 'Start a new memory from a photo',
  });

  return cards.slice(0, 9);
}

// ─── SwipeTaskCard ─────────────────────────────────────────────────────────────

function SwipeTaskCard({
  card,
  onComplete,
  onDismiss,
  onTap,
}: {
  card: TaskCard;
  onComplete: () => void;
  onDismiss: () => void;
  onTap: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const [settling, setSettling] = useState(false);
  const [gone, setGone] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);

  const THRESHOLD = 80;
  const canDismissLeft = card.type !== 'create-ember';

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
      } else {
        return;
      }
    }

    const clamped = !canDismissLeft ? Math.max(0, dx) : dx;
    setDragX(clamped);
  }

  function handlePointerUp() {
    if (!startPos.current) return;
    const wasSwipe = swiping.current;
    const dx = dragX;
    startPos.current = null;
    swiping.current = false;

    if (!wasSwipe) {
      onTap();
      return;
    }

    setSettling(true);

    if (dx >= THRESHOLD) {
      if (card.type === 'create-ember') {
        // Snap back, open picker
        setDragX(0);
        setTimeout(() => setSettling(false), 300);
        onComplete();
      } else {
        setDragX(window.innerWidth);
        setTimeout(() => { setGone(true); onComplete(); }, 260);
      }
    } else if (dx <= -THRESHOLD && canDismissLeft) {
      setDragX(-window.innerWidth);
      setTimeout(() => { setGone(true); onDismiss(); }, 260);
    } else {
      setDragX(0);
      setTimeout(() => setSettling(false), 300);
    }
  }

  if (gone) return null;

  const rightPct = Math.max(0, Math.min(1, dragX / THRESHOLD));
  const leftPct = canDismissLeft ? Math.max(0, Math.min(1, -dragX / THRESHOLD)) : 0;

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ height: 72 }}>
      {/* Right-swipe background: Go */}
      <div
        className="absolute inset-0 flex items-center pl-5 rounded-2xl"
        style={{ background: '#f97316', opacity: rightPct }}
      >
        <span className="text-white text-sm font-semibold">Go →</span>
      </div>

      {/* Left-swipe background: Later */}
      {canDismissLeft && (
        <div
          className="absolute inset-0 flex items-center justify-end pr-5 rounded-2xl"
          style={{ background: '#1f2937', opacity: leftPct }}
        >
          <span className="text-white/50 text-sm font-medium">Later</span>
        </div>
      )}

      {/* Card */}
      <div
        ref={cardRef}
        className="absolute inset-0 flex items-center gap-3 px-3 rounded-2xl select-none"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
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
        {/* Thumbnail or ember mark */}
        <div
          className="flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
          style={{
            width: 48,
            height: 48,
            background: card.type === 'create-ember'
              ? 'rgba(249,115,22,0.12)'
              : 'var(--bg-muted, rgba(255,255,255,0.06))',
            border: card.type === 'create-ember'
              ? '1px solid rgba(249,115,22,0.25)'
              : '1px solid var(--border-subtle)',
          }}
        >
          {card.thumbnailSrc ? (
            <img
              src={card.thumbnailSrc}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <EmberMark size={22} />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium leading-snug truncate">{card.label}</p>
          <p className="text-xs leading-snug mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {card.sub}
          </p>
        </div>

        {/* Chevron */}
        <ChevronRight
          size={15}
          strokeWidth={2}
          className="flex-shrink-0 mr-1"
          style={{ color: 'rgba(255,255,255,0.2)' }}
        />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

type Step = 'home' | 'confirm' | 'processing';

export default function UserHomeScreen({
  initialProfile,
  initialImages,
  initialAvatarUrl,
}: {
  initialProfile: { name: string | null; email: string } | null;
  initialImages?: Array<{ accessType: string }>;
  initialAvatarUrl?: string | null;
}) {
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

  const [embers, setEmbers] = useState<EmberSummary[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const displayName = initialProfile?.name || initialProfile?.email || 'Ember User';
  const firstName = (displayName || '').split(/\s+/)[0] ?? displayName;

  // ── Data fetching ──────────────────────────────────────────────────────────

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

  useEffect(() => {
    void fetch('/api/images', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return;
        const payload = (await res.json()) as EmberSummary[];
        setEmbers(payload);
      })
      .catch(() => undefined);
  }, [createdImageId]);

  // ── File / paste handling ──────────────────────────────────────────────────

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
      router.replace(`/home?id=${createdImageId}&ember=owner`);
    }, 400);
    return () => clearTimeout(timer);
  }, [createdImageId, step, router]);

  // ── Create ember ───────────────────────────────────────────────────────────

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

  // ── Cards ──────────────────────────────────────────────────────────────────

  const visibleCards = buildCards(embers).filter((c) => !dismissed.has(c.id));

  function handleCardComplete(card: TaskCard) {
    if (card.type === 'create-ember') {
      fileInputRef.current?.click();
    } else if (card.href) {
      router.push(card.href);
    }
  }

  function handleCardDismiss(card: TaskCard) {
    setDismissed((prev) => new Set([...prev, card.id]));
  }

  function handleCardTap(card: TaskCard) {
    if (card.type === 'create-ember') {
      fileInputRef.current?.click();
    } else if (card.href) {
      router.push(card.href);
    }
  }

  // ── Confirm step ───────────────────────────────────────────────────────────

  if (step === 'confirm' && previewUrl) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center px-6"
        style={{ background: 'var(--bg-screen)', paddingTop: 56 }}
      >
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
        <div
          className="w-full rounded-2xl overflow-hidden"
          style={{ maxWidth: 420, border: '1px solid var(--border-default)' }}
        >
          <img src={previewUrl} alt="Selected photo" className="w-full h-auto block" />
        </div>
        <div className="w-full flex flex-col gap-5 mt-7" style={{ maxWidth: 420 }}>
          <p className="text-white font-medium text-base text-center leading-snug">
            Create an ember from this photo?
          </p>
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

  // ── Processing step ────────────────────────────────────────────────────────

  if (step === 'processing') {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center px-8"
        style={{ background: 'var(--bg-screen)', paddingTop: 56 }}
      >
        <AppHeader avatarUrl={avatarUrl} userInitials={initials(displayName)} userModalHref="/account" />
        <style>{'@keyframes kipSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: 96,
            height: 96,
            background: 'rgba(249,115,22,0.15)',
            border: '1.5px solid rgba(249,115,22,0.55)',
            animation: 'kipSpin 1.5s linear infinite',
          }}
        >
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

  // ── Home step ──────────────────────────────────────────────────────────────

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

      {/* Drag-over overlay */}
      {isDragOver && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ background: 'rgba(249,115,22,0.08)', border: '2px dashed #f97316' }}
        >
          <p className="text-white font-medium text-lg">Drop to create ember</p>
        </div>
      )}

      {/* Scrollable content */}
      <div
        className="absolute left-0 right-0 bottom-0 overflow-y-auto no-scrollbar flex flex-col items-center px-4"
        style={{ top: 56 }}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        <div className="w-full max-w-xl">

          {/* Greeting */}
          <div className="pt-5 pb-5">
            <h1 className="text-white text-2xl font-bold tracking-tight">Hello {firstName}</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {visibleCards.length > 1
                ? `${visibleCards.length - 1} thing${visibleCards.length - 1 !== 1 ? 's' : ''} to tend`
                : 'Your embers are looking good'}
            </p>
          </div>

          {/* Task queue */}
          <div className="mb-8">
            <p
              className="text-xs font-semibold mb-3 tracking-wide uppercase"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              To tend
            </p>

            {visibleCards.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div
                  className="rounded-full flex items-center justify-center"
                  style={{ width: 56, height: 56, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}
                >
                  <EmberMark size={26} />
                </div>
                <p className="text-sm font-medium text-white/60">All caught up</p>
                <p className="text-xs text-white/30">Your embers are well tended</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {visibleCards.map((card) => (
                  <SwipeTaskCard
                    key={card.id}
                    card={card}
                    onComplete={() => handleCardComplete(card)}
                    onDismiss={() => handleCardDismiss(card)}
                    onTap={() => handleCardTap(card)}
                  />
                ))}
              </div>
            )}

            {/* Swipe hint — only shown if there are dismissable cards */}
            {visibleCards.some((c) => c.type !== 'create-ember') && (
              <p
                className="text-center text-xs mt-4"
                style={{ color: 'rgba(255,255,255,0.18)' }}
              >
                Swipe right to go · left to hold off
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
