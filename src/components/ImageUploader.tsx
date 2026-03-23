'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import UploadStarterCard from '@/components/UploadStarterCard';
import UploadConfirmModal from '@/components/UploadConfirmModal';

const UPLOAD_STEPS = [
  'Uploading your media',
  'Reading the scene',
  'Naming your Ember',
  'Building the memory page',
  'Looking for familiar faces',
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

export default function ImageUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const [uploadStepIndex, setUploadStepIndex] = useState(0);
  const pathname = usePathname();
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
    const openFilePicker = () => {
      fileInputRef.current?.click();
    };

    window.addEventListener('ember:open-upload-picker', openFilePicker);
    return () => window.removeEventListener('ember:open-upload-picker', openFilePicker);
  }, []);

  useEffect(() => {
    if (searchParams.get('openUploader') !== '1' || selectedFile) {
      return;
    }

    fileInputRef.current?.click();
    window.history.replaceState(null, '', pathname || '/create');
  }, [pathname, router, searchParams, selectedFile]);

  const updateSelection = useCallback(
    (file: File | null) => {
      const nextMediaType = detectSelectedMediaType(file);

      if (!file || !nextMediaType) {
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

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      updateSelection(event.dataTransfer.files[0] || null);
    },
    [updateSelection]
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      updateSelection(event.target.files?.[0] || null);
    },
    [updateSelection]
  );

  const handleUpload = async () => {
    if (!selectedFile) {
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/images', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Upload failed');
      }

      const { id, mediaType, warning } = await response.json();

      if (warning) {
        alert(
          `${mediaType === 'VIDEO' ? 'Video' : 'Image'} uploaded, but the automatic wiki did not finish: ${warning}`
        );
      }

      router.push(`/image/${id}?fromUpload=1`);
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload media. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setSelectedFile(null);
    setPreview(null);
    setSelectionError('');
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
                    Hang on while Ember uploads the media, reads the moment, and prepares the first version of the memory.
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
        onChange={handleFileSelect}
        className="hidden"
        id="file-input"
      />
      <UploadStarterCard
        title="Create an Ember"
        subtitle="Upload a photo or video to start a new ember."
        supportText="Supports JPG, PNG, GIF, WebP, MP4, MOV, WEBM, and M4V."
        isDragging={isDragging}
        onOpenPicker={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />

      {selectionError && (
        <div className="ember-status ember-status-error mt-4">{selectionError}</div>
      )}

      <UploadConfirmModal
        open={Boolean(selectedFile && preview && !isUploading)}
        preview={preview}
        mediaType={selectedMediaType}
        fileName={selectedFile?.name || 'Selected media'}
        title="Create an Ember"
        subtitle=""
        confirmLabel="Create an Ember"
        confirmBusyLabel={`Uploading ${selectedMediaType || 'media'}...`}
        cancelLabel="Pick a different Ember"
        isSubmitting={isUploading}
        onCancel={clearSelection}
        onConfirm={() => void handleUpload()}
      />
    </div>
  );
}
