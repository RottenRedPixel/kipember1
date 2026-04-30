'use client';

import { Pencil, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type ImageTagShape = {
  id: string;
  label: string;
  leftPct?: number | null;
  topPct?: number | null;
  widthPct?: number | null;
  heightPct?: number | null;
};

type TagPeopleDetail = {
  tags?: ImageTagShape[];
};

type FaceTag = {
  id: string; // local React key (temp id before save, then db id)
  dbId: string | null; // null until saved to DB
  x: number; // center % of image width
  y: number; // center % of image height
  color: string;
  name: string;
};

type DetectedFace = {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
};

const CIRCLE_SIZE = 12; // % of image width
const TAG_COLORS = [
  '#f97316',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#ef4444',
];

export default function TagPeopleSlider({
  detail,
  imageId,
  coverPhotoUrl,
}: {
  detail: TagPeopleDetail | null;
  imageId: string | null;
  coverPhotoUrl: string | null;
}) {
  const [faceTags, setFaceTags] = useState<FaceTag[]>([]);
  const [taggingMode, setTaggingMode] = useState(true);
  const [draggingTagId, setDraggingTagId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [imgAspectRatio, setImgAspectRatio] = useState(1);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [detectingFaces, setDetectingFaces] = useState(false);

  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const tagImgRef = useRef<HTMLImageElement | null>(null);
  const faceTagsRef = useRef(faceTags);
  const savePositionRef = useRef<(tagId: string) => void>(() => {});
  const dragStart = useRef<{
    clientX: number;
    clientY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Keep faceTagsRef in sync so the drag pointerup handler always sees the
  // latest tags by reference, not a stale closure.
  useEffect(() => {
    faceTagsRef.current = faceTags;
  }, [faceTags]);

  // Re-bind savePositionRef every render so it always captures the latest
  // imgAspectRatio + imageId.
  savePositionRef.current = (tagId: string) => {
    const tag = faceTagsRef.current.find((t) => t.id === tagId);
    if (!tag?.dbId || !imageId) return;
    fetch(`/api/images/${imageId}/tags/${tag.dbId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leftPct: tag.x - CIRCLE_SIZE / 2,
        topPct: tag.y - (CIRCLE_SIZE * imgAspectRatio) / 2,
        widthPct: CIRCLE_SIZE,
        heightPct: CIRCLE_SIZE * imgAspectRatio,
        refreshWiki: false,
      }),
    }).catch(() => {});
  };

  // Load existing positioned tags from `detail.tags` when the slider mounts /
  // when detail.tags changes.
  useEffect(() => {
    if (!detail?.tags) return;
    const positioned = detail.tags.filter(
      (t) =>
        t.leftPct != null && t.topPct != null && t.widthPct != null && t.heightPct != null
    );
    if (positioned.length === 0) return;
    setFaceTags(
      positioned.map((t, i) => ({
        id: t.id,
        dbId: t.id,
        x: t.leftPct! + t.widthPct! / 2,
        y: t.topPct! + t.heightPct! / 2,
        color: TAG_COLORS[i % TAG_COLORS.length],
        name: t.label,
      }))
    );
  }, [detail?.tags]);

  // Drag-to-reposition pointer handlers.
  useEffect(() => {
    if (!draggingTagId) return;
    const container = imageContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    function onMove(e: PointerEvent) {
      const d = dragStart.current;
      if (!d) return;
      const dx = ((e.clientX - d.clientX) / rect.width) * 100;
      const dy = ((e.clientY - d.clientY) / rect.height) * 100;
      setFaceTags((prev) =>
        prev.map((t) =>
          t.id === draggingTagId
            ? {
                ...t,
                x: Math.max(0, Math.min(100, d.origX + dx)),
                y: Math.max(0, Math.min(100, d.origY + dy)),
              }
            : t
        )
      );
    }

    function onUp() {
      const tagId = draggingTagId;
      setDraggingTagId(null);
      dragStart.current = null;
      if (tagId) savePositionRef.current(tagId);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [draggingTagId]);

  async function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!taggingMode || draggingTagId) return;
    const container = imageContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const color = TAG_COLORS[faceTags.length % TAG_COLORS.length];
    const tempId = `tag-${Date.now()}`;
    const defaultName = `Person ${faceTags.length + 1}`;
    setFaceTags((prev) => [
      ...prev,
      { id: tempId, dbId: null, x, y, color, name: defaultName },
    ]);
    setEditingTagId(tempId);
    setEditingName(defaultName);

    if (imageId) {
      const ar = imgAspectRatio;
      const res = await fetch(`/api/images/${imageId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: defaultName,
          leftPct: x - CIRCLE_SIZE / 2,
          topPct: y - (CIRCLE_SIZE * ar) / 2,
          widthPct: CIRCLE_SIZE,
          heightPct: CIRCLE_SIZE * ar,
          refreshWiki: false,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload?.tag?.id) {
        const dbId = payload.tag.id as string;
        setFaceTags((prev) =>
          prev.map((t) => (t.id === tempId ? { ...t, id: dbId, dbId } : t))
        );
        setEditingTagId((prev) => (prev === tempId ? dbId : prev));
      }
    }
  }

  function handleCirclePointerDown(e: React.PointerEvent<HTMLDivElement>, tag: FaceTag) {
    if (!taggingMode) return;
    e.stopPropagation();
    e.preventDefault();
    dragStart.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX: tag.x,
      origY: tag.y,
    };
    setDraggingTagId(tag.id);
  }

  async function handleDeleteTag(id: string) {
    const tag = faceTags.find((t) => t.id === id);
    setFaceTags((prev) => prev.filter((t) => t.id !== id));
    if (editingTagId === id) setEditingTagId(null);
    if (tag?.dbId && imageId) {
      await fetch(`/api/images/${imageId}/tags/${tag.dbId}`, { method: 'DELETE' });
    }
  }

  function handleEditTag(tag: FaceTag) {
    setEditingTagId(tag.id);
    setEditingName(tag.name);
  }

  async function handleSaveTagName(id: string) {
    const tag = faceTags.find((t) => t.id === id);
    const name = editingName.trim() || tag?.name || 'Unknown';
    setFaceTags((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    setEditingTagId(null);
    if (tag?.dbId && imageId) {
      await fetch(`/api/images/${imageId}/tags/${tag.dbId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: name, refreshWiki: false }),
      });
    }
  }

  // detectingFaces is wired but the Auto Detect button is currently disabled
  // in the UI. Keeping the handler for when the flow is re-enabled.
  void detectingFaces;
  void setDetectingFaces;
  async function handleDetectFaces() {
    const img = tagImgRef.current;
    if (!img || !imageId || detectingFaces) return;
    setDetectingFaces(true);
    setDetectedFaces([]);
    setImgAspectRatio(img.naturalWidth / img.naturalHeight);
    try {
      if (typeof window !== 'undefined' && window.FaceDetector) {
        const detector = new window.FaceDetector({
          fastMode: true,
          maxDetectedFaces: 20,
        });
        const faces = await detector.detect(img);
        setDetectedFaces(
          faces.map((f) => ({
            leftPct: (f.boundingBox.x / img.naturalWidth) * 100,
            topPct: (f.boundingBox.y / img.naturalHeight) * 100,
            widthPct: (f.boundingBox.width / img.naturalWidth) * 100,
            heightPct: (f.boundingBox.height / img.naturalHeight) * 100,
          }))
        );
      } else {
        const res = await fetch(`/api/images/${imageId}/detect-faces`, {
          method: 'POST',
        });
        const payload = await res.json().catch(() => ({}));
        setDetectedFaces(payload?.faces ?? []);
      }
    } catch {
      // silently skip
    } finally {
      setDetectingFaces(false);
    }
  }
  void handleDetectFaces;

  return (
    <>
      {coverPhotoUrl ? (
        <div
          ref={imageContainerRef}
          className="w-full rounded-xl overflow-hidden relative"
          style={{
            border: '1px solid var(--border-subtle)',
            cursor: taggingMode ? 'crosshair' : 'default',
          }}
          onClick={handleImageClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={tagImgRef}
            src={coverPhotoUrl}
            alt="Ember"
            className="w-full h-auto block"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setImgAspectRatio(img.naturalWidth / img.naturalHeight);
              }
            }}
          />
          {/* Detected face circles */}
          {detectedFaces.map((face, i) => {
            const ar = imgAspectRatio;
            const size = Math.max(face.widthPct, face.heightPct / ar);
            const cx = face.leftPct + face.widthPct / 2;
            const cy = face.topPct + face.heightPct / 2;
            return (
              <div
                key={i}
                className="absolute rounded-full pointer-events-none"
                style={{
                  left: `${cx - size / 2}%`,
                  top: `${cy - (size * ar) / 2}%`,
                  width: `${size}%`,
                  aspectRatio: '1 / 1',
                  border: '2px solid rgba(255,255,255,0.85)',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
                }}
              />
            );
          })}
          {/* Manual face tags */}
          {faceTags.map((tag) => {
            const ar = imgAspectRatio;
            const left = tag.x - CIRCLE_SIZE / 2;
            const top = tag.y - (CIRCLE_SIZE * ar) / 2;
            return (
              <div key={tag.id}>
                <div
                  className="absolute rounded-full"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${CIRCLE_SIZE}%`,
                    aspectRatio: '1 / 1',
                    border: `2.5px solid ${tag.color}`,
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                    cursor: taggingMode ? 'grab' : 'default',
                    touchAction: 'none',
                  }}
                  onPointerDown={(e) => handleCirclePointerDown(e, tag)}
                  onClick={(e) => e.stopPropagation()}
                />
                {tag.name ? (
                  <div
                    className="absolute text-xs font-semibold px-1.5 py-0.5 rounded pointer-events-none"
                    style={{
                      left: `${tag.x}%`,
                      top: `${top + CIRCLE_SIZE * ar + 0.5}%`,
                      transform: 'translateX(-50%)',
                      background: 'rgba(0,0,0,0.65)',
                      color: tag.color,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tag.name}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Tag list */}
      {faceTags.length > 0 ? (
        <div className="flex flex-col gap-2">
          {faceTags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-3 px-4 rounded-xl"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                minHeight: 44,
              }}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: tag.color }}
              />
              {editingTagId === tag.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => handleSaveTagName(tag.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveTagName(tag.id);
                    if (e.key === 'Escape') setEditingTagId(null);
                  }}
                  className="flex-1 bg-transparent text-white text-sm outline-none"
                  placeholder="Enter name..."
                />
              ) : (
                <span className="flex-1 text-white text-sm">
                  {tag.name || 'Unnamed'}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleEditTag(tag)}
                className="w-8 h-8 flex items-center justify-center rounded-full opacity-50 can-hover"
                style={{ cursor: 'pointer' }}
              >
                <Pencil size={13} color="var(--text-primary)" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteTag(tag.id)}
                className="w-8 h-8 flex items-center justify-center rounded-full opacity-50 can-hover"
                style={{ cursor: 'pointer' }}
              >
                <X size={14} color="#f87171" strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          disabled
          className="flex-1 flex items-center justify-center rounded-full text-white/30 text-sm font-medium disabled:opacity-50"
          style={{
            background: 'transparent',
            border: '1.5px solid var(--border-btn)',
            minHeight: 44,
            cursor: 'not-allowed',
          }}
        >
          Auto Detect
        </button>
        <button
          type="button"
          onClick={() => setTaggingMode((v) => !v)}
          className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium"
          style={{
            background: taggingMode ? '#f97316' : 'transparent',
            border: taggingMode ? 'none' : '1.5px solid var(--border-btn)',
            minHeight: 44,
            cursor: 'pointer',
          }}
        >
          {taggingMode ? 'Done Tagging' : 'Tag Faces'}
        </button>
      </div>
    </>
  );
}
