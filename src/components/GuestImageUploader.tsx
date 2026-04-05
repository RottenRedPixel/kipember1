'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import UploadStarterCard from '@/components/UploadStarterCard';
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

export default function GuestImageUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
    if (searchParams.get('openGuestUploader') !== '1' || selectedFile) {
      return;
    }

    fileInputRef.current?.click();
    window.history.replaceState(null, '', pathname || '/');
  }, [pathname, searchParams, selectedFile]);

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

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
    setUploadStepIndex(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadPromise = fetch('/api/guest/upload', {
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

      const { token, warning } = await response.json();

      if (warning) {
        alert(warning);
      }

      await new Promise((resolve) => window.setTimeout(resolve, 500));
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
      <UploadProcessingOverlay
        open={isUploading}
        stageIndex={uploadStepIndex}
        mediaType={selectedMediaType}
      />

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
        subtitle="Upload a photo to create your first ember."
        supportText="Supports JPG, PNG, GIF, and WebP."
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
      />
    </div>
  );
}
