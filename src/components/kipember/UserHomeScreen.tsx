'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CircleEllipsis, LogOut, ShieldEllipsis } from 'lucide-react';

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

function SvgItem({
  label,
  href,
  onClick,
  icon: Icon,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}) {
  const inner = (
    <div className="flex flex-col items-center gap-1.5">
      <Icon size={28} strokeWidth={1.6} />
      <span className="text-xs text-center leading-tight">{label}</span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="svg-item">
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="svg-item" style={{ cursor: 'pointer' }}>
      {inner}
    </button>
  );
}

type Step = 'home' | 'confirm' | 'processing';

export default function UserHomeScreen({
  initialProfile,
}: {
  initialProfile: { name: string | null; email: string } | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<Step>('home');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [createdImageId, setCreatedImageId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const displayName = initialProfile?.name || initialProfile?.email || 'Ember User';

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!createdImageId || step !== 'processing') return;
    const timer = setTimeout(() => {
      router.replace(`/home?id=${createdImageId}&ember=welcome`);
    }, 2400);
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

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/signin');
    router.refresh();
  }

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
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg-screen)' }}>
        <div className="absolute top-4 left-4">
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
      <div className="fixed inset-0 flex flex-col items-center justify-center px-8" style={{ background: 'var(--bg-screen)' }}>
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

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-5 gap-3"
      style={{ background: 'var(--bg-screen)' }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setSelectedFile(file);
          setPreviewUrl(URL.createObjectURL(file));
          setUploadError('');
          setStep('confirm');
        }}
      />

      <div className="w-full flex flex-col gap-3" style={{ maxWidth: 420 }}>

        {/* Profile */}
        <div className="flex flex-col items-center py-4 gap-2">
          <Link href="/user/profile">
            <div
              className="rounded-full flex items-center justify-center overflow-hidden"
              style={{ width: 72, height: 72, background: 'rgba(249,115,22,0.85)' }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
              ) : (
                <span className="text-white text-lg font-medium">{initials(displayName)}</span>
              )}
            </div>
          </Link>
          <span className="text-white font-semibold text-base">{displayName}</span>
        </div>

        {/* Actions */}
        <div className="px-4 py-2">
          <div className="grid grid-cols-3" style={{ gap: '0 8px' }}>
            <SvgItem label="My Embers" href="/user/my-embers" icon={ShieldEllipsis} />
            <SvgItem label="Shared Embers" href="/user/shared-embers" icon={CircleEllipsis} />
            <SvgItem label="Logout" onClick={handleLogout} icon={LogOut} />
          </div>
        </div>

        {/* Create ember */}
        <div
          className="flex flex-col items-center gap-3 rounded-2xl px-6 py-8"
          style={{ background: 'var(--bg-surface)' }}
        >
          <EmberMark size={44} />
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-white font-medium text-base">Create a new ember</p>
            <p className="text-white/60 text-sm leading-snug">
              Choose a photo or video to start a new memory.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-8 rounded-full text-white text-sm font-medium cursor-pointer can-hover-dim"
            style={{ background: '#f97316', minHeight: 44 }}
          >
            Choose Photo
          </button>
        </div>

      </div>
    </div>
  );
}
