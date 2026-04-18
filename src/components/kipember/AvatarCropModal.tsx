'use client';

import Cropper from 'react-easy-crop';
import { useState, useCallback } from 'react';
import { getCroppedImageBlob } from '@/lib/crop-image';

type CroppedArea = { x: number; y: number; width: number; height: number };

export default function AvatarCropModal({
  imageSrc,
  onConfirm,
  onCancel,
}: {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
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
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.95)' }}>
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

      {/* Zoom slider */}
      <div className="px-8 py-4" style={{ background: 'rgba(0,0,0,0.9)' }}>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-orange-500"
          style={{ accentColor: '#f97316' }}
        />
        <p className="text-center text-xs text-white/40 mt-1">Pinch or drag to adjust</p>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 px-6 pb-8 pt-2" style={{ background: 'rgba(0,0,0,0.9)' }}>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full text-white text-sm font-medium cursor-pointer"
          style={{ minHeight: 44, background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.15)' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          className="flex-1 rounded-full text-white text-sm font-medium cursor-pointer"
          style={{ minHeight: 44, background: '#f97316' }}
        >
          Save Photo
        </button>
      </div>
    </div>
  );
}
