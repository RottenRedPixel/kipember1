'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import UploadStarterCard from '@/components/UploadStarterCard';

const UPLOAD_STEPS = [
  'Uploading your media',
  'Reading the scene',
  'Writing a quick first memory',
  'Preparing Ember to talk with you',
];

function detectSelectedMediaType(file: File | null): 'image' | 'video' | null {
  if (!file) {
    return null;
  }

  if (file.type.startsWith('video/')) {
    return 'video';
  }

  if (file.type.startsWith('image/')) {
    return 'image';
  }

  return null;
}

export default function GuestImageUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStepIndex, setUploadStepIndex] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  useEffect(() => {
    if (!isUploading) {
      setUploadStepIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setUploadStepIndex((current) =>
        current < UPLOAD_STEPS.length - 1 ? current + 1 : current
      );
    }, 1500);

    return () => window.clearInterval(intervalId);
  }, [isUploading]);

  useEffect(() => {
    if (searchParams.get('openGuestUploader') !== '1' || selectedFile) {
      return;
    }

    fileInputRef.current?.click();
    window.history.replaceState(null, '', '/');
  }, [searchParams, selectedFile]);

  const updateSelection = useCallback(
    (file: File | null) => {
      const mediaType = detectSelectedMediaType(file);

      if (!file || !mediaType) {
        setSelectionError('Only photos and MP4, MOV, WEBM, or M4V videos are supported.');
        return;
      }

      if (preview) {
        URL.revokeObjectURL(preview);
      }

      setSelectionError('');
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
    },
    [preview]
  );

  const clearSelection = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setSelectedFile(null);
    setPreview(null);
    setSelectionError('');
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/guest/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Upload failed');
      }

      const { token, warning } = await response.json();

      if (warning) {
        alert(warning);
      }

      router.push(`/guest/${token}`);
    } catch (error) {
      console.error('Guest upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload media. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const selectedMediaType = detectSelectedMediaType(selectedFile);

  return (
    <div className="w-full">
      {isUploading && (
        <div className="fixed inset-0 z-[70] bg-[rgba(17,17,17,0.72)] px-4 py-6 backdrop-blur-md">
          <div className="mx-auto flex min-h-full w-full max-w-2xl items-center justify-center">
            <div className="w-full overflow-hidden rounded-[2.2rem] border border-white/10 bg-[rgba(20,20,20,0.88)] shadow-[0_32px_80px_rgba(0,0,0,0.35)]">
              <div className="grid gap-0 md:grid-cols-[1.05fr_0.95fr]">
                <div className="relative min-h-[18rem] overflow-hidden bg-black">
                  {selectedMediaType === 'video' ? (
                    <video
                      src={preview || undefined}
                      muted
                      playsInline
                      loop
                      autoPlay
                      className="h-full w-full object-cover opacity-45"
                    />
                  ) : (
                    <img
                      src={preview || undefined}
                      alt="Uploading preview"
                      className="h-full w-full object-cover opacity-45"
                    />
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,17,17,0.08),rgba(17,17,17,0.84))]" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">
                      Guest demo
                    </p>
                    <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                      {selectedFile?.name || 'Preparing upload'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-center px-6 py-7 sm:px-8">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,102,33,0.16)] text-[var(--ember-orange)]">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/52">
                        Ember is working
                      </p>
                      <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-white">
                        {UPLOAD_STEPS[uploadStepIndex]}
                      </div>
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-6 text-white/72">
                    Ember is building a quick visual read first, then setting up the interview that brings the memory to life.
                  </p>

                  <div className="mt-6 space-y-3">
                    {UPLOAD_STEPS.map((step, index) => {
                      const isActive = index === uploadStepIndex;
                      const isDone = index < uploadStepIndex;

                      return (
                        <div
                          key={step}
                          className={`flex items-center gap-3 rounded-[1rem] px-3 py-3 text-sm transition ${
                            isActive
                              ? 'bg-white/10 text-white'
                              : isDone
                                ? 'bg-white/6 text-white/74'
                                : 'bg-transparent text-white/42'
                          }`}
                        >
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                              isActive
                                ? 'bg-[var(--ember-orange)] text-white'
                                : isDone
                                  ? 'bg-white/18 text-white'
                                  : 'bg-white/10 text-white/60'
                            }`}
                          >
                            {isDone ? '✓' : index + 1}
                          </span>
                          <span>{step}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedFile ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
            onChange={(event) => updateSelection(event.target.files?.[0] || null)}
            className="hidden"
            id="guest-file-input"
          />
          <UploadStarterCard
            title="Create an Ember"
            subtitle="Upload a photo or video to create your first ember."
            supportText="Supports JPG, PNG, GIF, WebP, MP4, MOV, WEBM, and M4V."
            actionLabel="Create Ember"
            isDragging={isDragging}
            onOpenPicker={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              updateSelection(event.dataTransfer.files[0] || null);
            }}
          />

          {selectionError && (
            <div className="ember-status ember-status-error mt-4">{selectionError}</div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="ember-card relative overflow-hidden rounded-[1.75rem]">
            {selectedMediaType === 'video' ? (
              <video
                src={preview || undefined}
                controls
                playsInline
                preload="metadata"
                className="h-72 w-full object-contain bg-[var(--ember-charcoal)] sm:h-[30rem]"
              />
            ) : (
              <img
                src={preview || undefined}
                alt="Preview"
                className="h-72 w-full object-contain sm:h-[30rem]"
              />
            )}
            <button
              onClick={clearSelection}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-sm font-medium text-white"
            >
              x
            </button>
          </div>

          <div className="ember-card rounded-[1.6rem] px-5 py-4">
            <p className="text-sm font-semibold text-[var(--ember-text)]">
              What happens next
            </p>
            <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">
              First Ember gives a quick visual read. Then you can talk to Ember by text or have Ember call your phone to capture the memory in your own words.
            </p>
          </div>

          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="ember-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading
              ? `Uploading ${selectedMediaType || 'media'}...`
              : `Upload ${selectedMediaType || 'media'} and continue`}
          </button>
        </div>
      )}
    </div>
  );
}
