'use client';

import Cropper from 'react-easy-crop';
import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { getCroppedImageBlob } from '@/lib/crop-image';

type CroppedArea = { x: number; y: number; width: number; height: number };

export default function AvatarCropModal({
  imageSrc,
  onConfirm,
  onCancel,
  onChooseNew,
}: {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
  onChooseNew?: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedArea | null>(null);

  const onCropComplete = useCallback((_: unknown, pixels: CroppedArea) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
    onConfirm(blob);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--bg-screen)' }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{ height: 56, borderBottom: '1px solid var(--border-subtle)' }}
      >
        <p className="text-white font-medium text-base">Adjust photo</p>
        <button
          type="button"
          onClick={onCancel}
          className="w-9 h-9 flex items-center justify-center rounded-full can-hover-dim"
          style={{ background: 'var(--bg-surface)', cursor: 'pointer' }}
        >
          <X size={16} color="var(--text-primary)" strokeWidth={2} />
        </button>
      </div>

      {/* Crop area */}
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      {/* Bottom controls */}
      <div
        className="flex justify-center flex-shrink-0"
        style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-screen)' }}
      >
        <div className="w-full max-w-xl px-4 pt-4 pb-8 flex flex-col gap-4">
          {/* Zoom slider */}
          <div className="flex flex-col gap-1">
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: '#f97316' }}
            />
            <p className="text-center text-xs text-white/40">Pinch or drag to adjust</p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-full text-white text-sm font-medium cursor-pointer"
              style={{ minHeight: 44, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              Cancel
            </button>
            {onChooseNew ? (
              <button
                type="button"
                onClick={onChooseNew}
                className="flex-1 rounded-full text-white text-sm font-medium cursor-pointer"
                style={{ minHeight: 44, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
              >
                Choose new
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleConfirm()}
              className="flex-1 rounded-full text-white text-sm font-medium cursor-pointer can-hover-dim"
              style={{ minHeight: 44, background: '#f97316' }}
            >
              Save Photo
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
