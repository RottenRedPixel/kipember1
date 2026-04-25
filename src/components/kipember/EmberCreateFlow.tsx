'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
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

export default function EmberCreateFlow({
  file,
  avatarUrl,
  userInitials,
  onCancel,
}: {
  file: File;
  avatarUrl?: string | null;
  userInitials?: string;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<'confirm' | 'processing'>('confirm');
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [createdImageId, setCreatedImageId] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!createdImageId || step !== 'processing') return;
    const timer = setTimeout(() => {
      router.replace(`/ember/${createdImageId}?ember=owner`);
    }, 400);
    return () => clearTimeout(timer);
  }, [createdImageId, step, router]);

  async function handleCreate() {
    setUploadError('');
    setCreatedImageId(null);
    setStep('processing');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/images', { method: 'POST', body: formData });
      const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!response.ok || typeof payload?.id !== 'string') {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to create ember');
      }
      setCreatedImageId(payload.id);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to create ember');
      setStep('confirm');
    }
  }

  if (step === 'confirm' && previewUrl) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg-screen)', paddingTop: 56 }}>
        <AppHeader avatarUrl={avatarUrl} userInitials={userInitials} userModalHref="/account" />
        <div className="absolute top-4 left-4" style={{ top: 64 }}>
          <button
            type="button"
            onClick={onCancel}
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
              onClick={onCancel}
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

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-8" style={{ background: 'var(--bg-screen)', paddingTop: 56 }}>
      <AppHeader avatarUrl={avatarUrl} userInitials={userInitials} userModalHref="/account" />
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
