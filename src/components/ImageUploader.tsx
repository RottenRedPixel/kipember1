'use client';

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
        throw new Error('Upload failed');
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
      alert('Failed to upload media. Please try again.');
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
            className={`cursor-pointer rounded-[2rem] border-2 border-dashed p-10 text-center transition-colors ${
              isDragging
                ? 'border-sky-500 bg-sky-50'
                : 'border-slate-300 bg-slate-50/80 hover:border-slate-400'
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
              <div className="mb-4 text-6xl">🎞️</div>
              <p className="text-lg font-medium text-slate-800">
                Drop a photo or video here or click to start a new Ember
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Photos plus MP4, MOV, WEBM, and M4V videos
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Videos automatically get a poster frame so Ember can build the first wiki.
              </p>
            </label>
          </div>

          {selectionError && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {selectionError}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-[2rem] bg-slate-100">
            {selectedMediaType === 'video' ? (
              <video
                src={preview || undefined}
                controls
                playsInline
                preload="metadata"
                className="h-64 w-full object-contain bg-slate-950"
              />
            ) : (
              <img src={preview || undefined} alt="Preview" className="h-64 w-full object-contain" />
            )}
            <button
              onClick={clearSelection}
              className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
            >
              x
            </button>
          </div>

          <div>
            <label htmlFor="description" className="mb-2 block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What makes this Ember meaningful? Add context Ember should know."
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 placeholder-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none"
              rows={3}
            />
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <input
              type="checkbox"
              checked={shareToNetwork}
              onChange={(event) => setShareToNetwork(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">
                Share this Ember to your network feed
              </span>
              <span className="mt-1 block text-sm text-slate-500">
                Accepted friends will see it in their feed. Contributors can still be invited individually.
              </span>
            </span>
          </label>

          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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
