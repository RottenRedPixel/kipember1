'use client';

import Cropper from 'react-easy-crop';
import { useEffect, useRef, useState } from 'react';

type FrameDetail = {
  cropX?: number | null;
  cropY?: number | null;
};

type CroppedArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function FrameSlider({
  detail,
  imageId,
  coverPhotoUrl,
  refreshDetail,
  onStatus,
}: {
  detail: FrameDetail | null;
  imageId: string | null;
  coverPhotoUrl: string | null;
  refreshDetail: () => Promise<unknown>;
  onStatus?: (message: string) => void;
}) {
  const [frameCrop, setFrameCrop] = useState({ x: 0, y: 0 });
  const [frameZoom, setFrameZoom] = useState(1);
  const [frameCroppedArea, setFrameCroppedArea] = useState<CroppedArea | null>(null);
  const [savedFrameCrop, setSavedFrameCrop] = useState<{ x: number; y: number } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [saving, setSaving] = useState(false);
  // Guards against react-easy-crop's mount-time onCropChange marking the
  // frame dirty before the user actually interacts.
  const initRef = useRef(false);

  // Sync the saved crop point from `detail`.
  useEffect(() => {
    if (!detail) {
      setSavedFrameCrop(null);
      return;
    }
    if (detail.cropX != null && detail.cropY != null) {
      setSavedFrameCrop({ x: detail.cropX, y: detail.cropY });
    } else {
      setSavedFrameCrop(null);
    }
  }, [detail]);

  // On mount of the slider, hold the initRef false for ~150ms so the cropper's
  // mount-time onCropChange doesn't trip the dirty flag.
  useEffect(() => {
    initRef.current = false;
    const t = setTimeout(() => {
      initRef.current = true;
    }, 150);
    return () => clearTimeout(t);
  }, []);

  async function handleSave() {
    if (!imageId) return;
    if (!resetPending && !frameCroppedArea) return;
    setSaving(true);
    try {
      const body = resetPending
        ? { crop: null }
        : {
            crop: {
              x: parseFloat((frameCroppedArea!.x + frameCroppedArea!.width / 2).toFixed(2)),
              y: parseFloat((frameCroppedArea!.y + frameCroppedArea!.height / 2).toFixed(2)),
              width: parseFloat(frameCroppedArea!.width.toFixed(2)),
              height: parseFloat(frameCroppedArea!.height.toFixed(2)),
            },
          };
      const response = await fetch(`/api/images/${imageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        if (resetPending) {
          setSavedFrameCrop(null);
          setResetPending(false);
        } else {
          const cx = frameCroppedArea!.x + frameCroppedArea!.width / 2;
          const cy = frameCroppedArea!.y + frameCroppedArea!.height / 2;
          setSavedFrameCrop({ x: cx, y: cy });
        }
        setIsDirty(false);
        onStatus?.('Frame saved.');
        await refreshDetail();
      } else {
        onStatus?.('Failed to save frame.');
      }
    } catch {
      onStatus?.('Failed to save frame.');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setFrameCrop({ x: 0, y: 0 });
    setFrameZoom(1);
    setResetPending(true);
    setIsDirty(true);
  }

  void savedFrameCrop; // currently informational only — referenced for future centering logic

  return (
    <>
      {coverPhotoUrl ? (
        <div className="flex flex-col gap-3">
          <div
            className="relative w-full rounded-xl overflow-hidden"
            style={{ aspectRatio: '3 / 4' }}
          >
            <Cropper
              image={coverPhotoUrl}
              crop={frameCrop}
              zoom={frameZoom}
              aspect={3 / 4}
              onCropChange={(c) => {
                setFrameCrop(c);
                if (initRef.current) {
                  setIsDirty(true);
                  setResetPending(false);
                }
              }}
              onZoomChange={(z) => {
                setFrameZoom(z);
                if (initRef.current) {
                  setIsDirty(true);
                  setResetPending(false);
                }
              }}
              onCropComplete={(croppedAreaPercentage) => {
                setFrameCroppedArea(croppedAreaPercentage);
              }}
              style={{
                containerStyle: { borderRadius: 12 },
                mediaStyle: {},
                cropAreaStyle: {
                  border: '2px solid rgba(249,115,22,0.8)',
                  borderRadius: 8,
                },
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={frameZoom}
              onChange={(e) => {
                setFrameZoom(Number(e.target.value));
                if (initRef.current) {
                  setIsDirty(true);
                  setResetPending(false);
                }
              }}
              className="w-full"
              style={{ accentColor: '#f97316' }}
            />
            <p className="text-center text-xs text-white/40">
              Drag to reframe · Pinch or slide to zoom
            </p>
          </div>
        </div>
      ) : (
        <p className="text-white/40 text-sm text-center py-8">No photo available.</p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="flex-1 rounded-full px-5 text-white text-sm font-medium btn-secondary flex items-center justify-center"
          style={{ border: '1.5px solid var(--border-btn)', minHeight: 44, cursor: 'pointer' }}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !isDirty || (!frameCroppedArea && !resetPending)}
          className="flex-1 rounded-full px-5 text-white text-sm font-medium disabled:opacity-60"
          style={{
            background: isDirty ? '#f97316' : 'var(--bg-surface)',
            border: isDirty ? 'none' : '1px solid var(--border-subtle)',
            minHeight: 44,
            cursor: isDirty ? 'pointer' : 'default',
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </>
  );
}
