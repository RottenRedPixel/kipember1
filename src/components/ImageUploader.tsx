'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import UploadConfirmModal from '@/components/UploadConfirmModal';
import UploadProcessingOverlay from '@/components/UploadProcessingOverlay';
import UploadStarterCard from '@/components/UploadStarterCard';

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

      <UploadStarterCard
        title="Add an Ember"
        subtitle="Choose the photo or video that should anchor the memory."
        supportText="Supports JPG, PNG, GIF, WebP, MP4, MOV, WEBM, and M4V."
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
        subtitle="Ember will use this upload as the reference image for the full memory layout."
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
