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

// Minimum time the user spends watching the loader after the upload POST
// completes. Image analysis is already running in the background — this hold
// gives it a head start so the ember view + wiki feel ready when we land.
const POST_UPLOAD_HOLD_MS = 10_000;

const PROCESSING_PHASES: Array<{ title: string; subtitle: string; startMs: number }> = [
  { title: 'Uploading your photo', subtitle: 'Sending the image up...', startMs: -1 },
  { title: 'Photo uploaded', subtitle: 'Reading the image...', startMs: 0 },
  { title: 'Analyzing the moment', subtitle: 'Looking for people, places, and details...', startMs: 2_500 },
  { title: 'Building the memory wiki', subtitle: 'Drafting your ember’s story...', startMs: 5_000 },
  { title: 'Almost ready', subtitle: 'Wrapping up the snapshot...', startMs: 7_500 },
];

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
  const [postCompletedAt, setPostCompletedAt] = useState<number | null>(null);
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Drive the status-line sequencer once the upload POST finishes.
  useEffect(() => {
    if (step !== 'processing' || postCompletedAt === null) return;
    const tick = () => {
      const elapsed = Date.now() - postCompletedAt;
      let nextIndex = 1;
      for (let i = 1; i < PROCESSING_PHASES.length; i += 1) {
        if (elapsed >= PROCESSING_PHASES[i].startMs) nextIndex = i;
      }
      setPhaseIndex(nextIndex);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [step, postCompletedAt]);

  // Redirect once the upload is done AND the minimum hold has elapsed.
  useEffect(() => {
    if (!createdImageId || postCompletedAt === null || step !== 'processing') return;
    const elapsed = Date.now() - postCompletedAt;
    const remaining = Math.max(0, POST_UPLOAD_HOLD_MS - elapsed);
    const timer = setTimeout(() => {
      router.replace(`/ember/${createdImageId}?ember=owner&view=full`);
    }, remaining);
    return () => clearTimeout(timer);
  }, [createdImageId, postCompletedAt, step, router]);

  async function handleCreate() {
    setUploadError('');
    setCreatedImageId(null);
    setPostCompletedAt(null);
    setPhaseIndex(0);
    setStep('processing');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/images', { method: 'POST', body: formData });
      const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!response.ok || typeof payload?.id !== 'string') {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to create ember');
      }
      setPostCompletedAt(Date.now());
      setCreatedImageId(payload.id);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to create ember');
      setStep('confirm');
      setPostCompletedAt(null);
      setPhaseIndex(0);
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
        {uploadError ? 'Something went wrong' : PROCESSING_PHASES[phaseIndex].title}
      </p>
      <p className="mt-1 text-sm text-white/60">
        {uploadError || PROCESSING_PHASES[phaseIndex].subtitle}
      </p>
    </div>
  );
}
