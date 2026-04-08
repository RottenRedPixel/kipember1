'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import UploadConfirmModal from '@/components/UploadConfirmModal';
import UploadProcessingOverlay from '@/components/UploadProcessingOverlay';

const PROCESSING_STAGE_DELAY_MS = 1100;

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

function UploadArrowIcon() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="text-black"
    >
      <path
        d="M12 16V5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 9.5L12 5L16.5 9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 15.5V17.5C5 18.6046 5.89543 19.5 7 19.5H17C18.1046 19.5 19 18.6046 19 17.5V15.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
    }
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
  }, [pathname, searchParams, selectedFile]);

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
    setUploadStepIndex(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadPromise = fetch('/api/images', {
        method: 'POST',
        body: formData,
      });

      await new Promise((resolve) => window.setTimeout(resolve, PROCESSING_STAGE_DELAY_MS));
      setUploadStepIndex(1);
      await new Promise((resolve) => window.setTimeout(resolve, PROCESSING_STAGE_DELAY_MS));
      setUploadStepIndex(2);

      const response = await uploadPromise;

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

      await new Promise((resolve) => window.setTimeout(resolve, 500));
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
      <UploadProcessingOverlay
        open={isUploading}
        stageIndex={uploadStepIndex}
        mediaType={selectedMediaType}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
        onChange={handleFileSelect}
        className="hidden"
        id="file-input"
      />

      <section className="flex h-full min-h-0 flex-col items-center text-center">
        <h1 className="mx-auto max-w-[18rem] text-[1.35rem] italic leading-[1.35] tracking-[-0.03em] text-black">
          Hi, This is <span className="font-semibold not-italic">ember.</span>
          <br />
          Let&apos;s start by uploading your photo!
        </h1>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mt-16 flex w-full flex-1 flex-col items-center justify-start text-center transition ${
            isDragging ? 'scale-[1.01]' : ''
          }`}
        >
          <UploadArrowIcon />
          <p className="mt-4 text-[1rem] font-semibold uppercase tracking-[-0.01em] text-black">
            Upload Photo Here
          </p>
        </button>
      </section>

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
        confirmLabel="Create"
        confirmBusyLabel="Creating..."
        cancelLabel="Back"
        isSubmitting={isUploading}
        onCancel={clearSelection}
        onConfirm={() => void handleUpload()}
        layout="create-screen"
      />
    </div>
  );
}
