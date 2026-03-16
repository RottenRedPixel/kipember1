'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [description, setDescription] = useState('');
  const [shareToNetwork, setShareToNetwork] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

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
      formData.append('description', description);
      formData.append('shareToNetwork', shareToNetwork ? 'true' : 'false');

      const response = await fetch('/api/images', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Upload failed');
      }

      const { id, mediaType, wikiGenerated, warning } = await response.json();

      if (warning) {
        alert(
          `${mediaType === 'VIDEO' ? 'Video' : 'Image'} uploaded, but the automatic wiki did not finish: ${warning}`
        );
      }

      router.push(wikiGenerated ? `/image/${id}/wiki` : `/image/${id}`);
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

    setSelectedFile(null);
    setPreview(null);
    setDescription('');
    setShareToNetwork(false);
    setSelectionError('');
  };

  const selectedMediaType = detectSelectedMediaType(selectedFile);

  return (
    <div className="w-full">
      {!selectedFile ? (
        <>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-[1.75rem] border border-dashed px-8 py-10 text-center ${
              isDragging
                ? 'border-[rgba(255,102,33,0.35)] bg-[rgba(255,102,33,0.06)]'
                : 'border-[rgba(20,20,20,0.12)] bg-white/70'
            }`}
          >
            <input
              type="file"
              accept="image/*,video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
              onChange={handleFileSelect}
              className="hidden"
              id="file-input"
            />
            <label htmlFor="file-input" className="cursor-pointer">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-[rgba(255,102,33,0.08)]">
                <Image src="/emberfav.svg" alt="" width={26} height={26} />
              </div>
              <h2 className="ember-heading mt-5 text-3xl text-[var(--ember-text)]">
                Drop a photo or video here
              </h2>
              <p className="ember-copy mt-3 text-sm">
                Click to start a new Ember. Photos and MP4, MOV, WEBM, or M4V videos
                are supported.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <span className="ember-chip">Photos</span>
                <span className="ember-chip">Video posters</span>
                <span className="ember-chip">Auto wiki</span>
              </div>
            </label>
          </div>

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
                className="h-72 w-full object-contain bg-[var(--ember-charcoal)]"
              />
            ) : (
              <img src={preview || undefined} alt="Preview" className="h-72 w-full object-contain" />
            )}
            <button
              onClick={clearSelection}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-sm font-medium text-white"
            >
              x
            </button>
          </div>

          <div>
            <label htmlFor="description" className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What makes this Ember meaningful? Add context Ember should know."
              className="ember-textarea"
              rows={4}
            />
          </div>

          <label className="ember-card flex items-start gap-3 rounded-[1.5rem] px-4 py-4">
            <input
              type="checkbox"
              checked={shareToNetwork}
              onChange={(event) => setShareToNetwork(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[var(--ember-line-strong)] text-[var(--ember-orange)]"
            />
            <span>
              <span className="block text-sm font-medium text-[var(--ember-text)]">
                Share this Ember to your network feed
              </span>
              <span className="mt-1 block text-sm text-[var(--ember-muted)]">
                Accepted friends will see it in their feed. Contributors can still be invited individually.
              </span>
            </span>
          </label>

          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="ember-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading
              ? `Uploading ${selectedMediaType || 'media'} and building wiki...`
              : `Upload ${selectedMediaType || 'media'} and build wiki`}
          </button>
        </div>
      )}
    </div>
  );
}
