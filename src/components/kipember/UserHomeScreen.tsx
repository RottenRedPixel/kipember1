'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, ChevronLeft, ChevronRight, Mic, Share2, UserPlus } from 'lucide-react';
import AppHeader from '@/components/kipember/AppHeader';

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
      router.replace(`/home?id=${createdImageId}&ember=owner`);
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
        <div className="pt-5 pb-2 flex flex-col gap-1">
          <h1 className="text-white text-2xl font-bold tracking-tight">Hello {firstName}</h1>
          <p className="text-white/60 text-sm">Good to see you again!</p>
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

        {/* c) Recent Activity */}
        <div className="mt-5">
          <p className="text-xs font-medium text-white/30 mb-3">Recent Activity</p>
          <div className="flex flex-col gap-2">
            {[
              { icon: UserPlus, title: 'New contributor joined', sub: 'Someone added to your ember', count: 4 },
              { icon: BookOpen, title: 'Wiki updated', sub: 'Ember knowledge base was refined', count: 1 },
            ].map(({ icon: Icon, title, sub, count }) => (
              <div key={title} className="flex items-center gap-3 can-hover-card rounded-xl">
                <div className="relative flex-shrink-0">
                  <div
                    className="flex items-center justify-center rounded-full"
                    style={{ width: 55, height: 55, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                  >
                    <Icon size={22} color="#6b7280" strokeWidth={1.6} />
                  </div>
                  {count ? (
                    <span
                      className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ minWidth: 18, height: 18, background: '#f97316', padding: '0 4px' }}
                    >
                      {count}
                    </span>
                  ) : null}
                </div>
                <div className="flex-1 min-w-0 px-2">
                  <p className="text-sm font-medium text-white leading-snug">{title}</p>
                  <p className="text-xs text-white/40 leading-snug">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* d) Requests */}
        <div className="mt-5 mb-8">
          <p className="text-xs font-medium text-white/30 mb-3">Requests</p>
          <div className="flex flex-col gap-2">
            {[
              { icon: Mic, title: 'Contribution request', sub: 'Someone wants to add a memory', count: 2 },
              { icon: Share2, title: 'Share request', sub: 'An ember was shared with you', count: 0 },
            ].map(({ icon: Icon, title, sub, count }) => (
              <div key={title} className="flex items-center gap-3 can-hover-card rounded-xl">
                <div className="relative flex-shrink-0">
                  <div
                    className="flex items-center justify-center rounded-full"
                    style={{ width: 55, height: 55, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                  >
                    <Icon size={22} color="#6b7280" strokeWidth={1.6} />
                  </div>
                  {count ? (
                    <span
                      className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ minWidth: 18, height: 18, background: '#f97316', padding: '0 4px' }}
                    >
                      {count}
                    </span>
                  ) : null}
                </div>
                <div className="flex-1 min-w-0 px-2">
                  <p className="text-sm font-medium text-white leading-snug">{title}</p>
                  <p className="text-xs text-white/40 leading-snug">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
