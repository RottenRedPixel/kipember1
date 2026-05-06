'use client';

import { Pencil, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pastelForContributorIdentity } from '@/lib/contributor-color';

type ImageTagShape = {
  id: string;
  label: string;
  leftPct?: number | null;
  topPct?: number | null;
  widthPct?: number | null;
  heightPct?: number | null;
};

type PeopleContributor = {
  contributorId: string;
  userId: string | null;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  alreadyTagged: boolean;
};

type AiSuggestion = {
  contributorId: string | null;
  userId: string | null;
  label: string;
  confidence: 'high' | 'medium' | 'low';
};

function initialsFor(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}

type TagPeopleDetail = {
  tags?: ImageTagShape[];
  analysis?: {
    peopleObserved?: Array<{ label: string }> | null;
  } | null;
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
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [hasChanges, setHasChanges] = useState(false);
  const [draggingTagId, setDraggingTagId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [imgAspectRatio, setImgAspectRatio] = useState(1);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [detectingFaces, setDetectingFaces] = useState(false);
  const [peopleSuggestions, setPeopleSuggestions] = useState<PeopleContributor[]>([]);
  const [aiSuggestionsByTagId, setAiSuggestionsByTagId] = useState<Record<string, AiSuggestion[]>>({});
  const [aiLoadingTagId, setAiLoadingTagId] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState('');

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
    if (mode !== 'edit' || draggingTagId) return;
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
        setHasChanges(true);
      }
    }
  }

  function handleCirclePointerDown(e: React.PointerEvent<HTMLDivElement>, tag: FaceTag) {
    if (mode !== 'edit') return;
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
    setHasChanges(true);
    if (tag?.dbId && imageId) {
      // Free-text save: keep label, clear any prior FK linkage so the tag
      // doesn't claim to be a contributor it isn't.
      await fetch(`/api/images/${imageId}/tags/${tag.dbId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: name,
          contributorId: null,
          userId: null,
          refreshWiki: false,
        }),
      });
    }
  }

  // ---- Picker: invited contributors + AI face-match suggestions ----------

  const refreshPeopleSuggestions = useCallback(async () => {
    if (!imageId) return;
    try {
      const res = await fetch(`/api/images/${imageId}/people-suggestions`);
      if (!res.ok) return;
      const payload = await res.json().catch(() => ({}));
      if (Array.isArray(payload?.contributors)) {
        setPeopleSuggestions(payload.contributors as PeopleContributor[]);
      }
    } catch {
      // silent
    }
  }, [imageId]);

  useEffect(() => {
    void refreshPeopleSuggestions();
  }, [refreshPeopleSuggestions]);

  async function loadAiSuggestionsForTag(tag: FaceTag) {
    if (!imageId || aiLoadingTagId) return;
    const ar = imgAspectRatio;
    setAiLoadingTagId(tag.id);
    try {
      const res = await fetch(`/api/images/${imageId}/tag-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faces: [
            {
              leftPct: tag.x - CIRCLE_SIZE / 2,
              topPct: tag.y - (CIRCLE_SIZE * ar) / 2,
              widthPct: CIRCLE_SIZE,
              heightPct: CIRCLE_SIZE * ar,
            },
          ],
        }),
      });
      const payload = await res.json().catch(() => ({}));
      const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
      setAiSuggestionsByTagId((prev) => ({
        ...prev,
        [tag.id]: suggestions.map((s: { contributorId: string | null; userId: string | null; label: string; confidence: 'high' | 'medium' | 'low' }) => ({
          contributorId: s.contributorId,
          userId: s.userId,
          label: s.label,
          confidence: s.confidence,
        })),
      }));
    } catch {
      // silent
    } finally {
      setAiLoadingTagId(null);
    }
  }

  async function handleSelectContributor(tagId: string, person: PeopleContributor) {
    const tag = faceTags.find((t) => t.id === tagId);
    if (!tag?.dbId || !imageId) return;
    setFaceTags((prev) => prev.map((t) => (t.id === tagId ? { ...t, name: person.name } : t)));
    setEditingTagId(null);
    setEditingName('');
    setHasChanges(true);
    await fetch(`/api/images/${imageId}/tags/${tag.dbId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: person.name,
        contributorId: person.contributorId,
        userId: person.userId,
        refreshWiki: false,
      }),
    });
    void refreshPeopleSuggestions();
  }

  async function handleSelectAiSuggestion(tagId: string, suggestion: AiSuggestion) {
    const tag = faceTags.find((t) => t.id === tagId);
    if (!tag?.dbId || !imageId) return;
    setFaceTags((prev) => prev.map((t) => (t.id === tagId ? { ...t, name: suggestion.label } : t)));
    setEditingTagId(null);
    setEditingName('');
    setHasChanges(true);
    await fetch(`/api/images/${imageId}/tags/${tag.dbId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: suggestion.label,
        contributorId: suggestion.contributorId,
        userId: suggestion.userId,
        refreshWiki: false,
      }),
    });
    void refreshPeopleSuggestions();
  }

  // Auto-detect faces and create a tag at each detected position.
  //
  // Uses the combined detect+match endpoint (/auto-tag) — a single Claude
  // vision call that simultaneously locates every face in the photo AND
  // matches each one against the owner's previously-tagged faces across
  // their other embers. Recognized people are auto-named (and linked via
  // contributorId / userId); unrecognized faces fall back to a "Person N"
  // placeholder that the owner can identify via the per-tag picker.
  async function handleAutoDetect() {
    const img = tagImgRef.current;
    if (!img || !imageId || detectingFaces) return;
    setDetectingFaces(true);
    setImgAspectRatio(img.naturalWidth / img.naturalHeight);
    try {
      type AutoTagFace = DetectedFace & {
        contributorId: string | null;
        userId: string | null;
        label: string | null;
        confidence: 'high' | 'medium' | 'low' | null;
      };

      let faces: AutoTagFace[] = [];
      try {
        const res = await fetch(`/api/images/${imageId}/auto-tag`, { method: 'POST' });
        const payload = await res.json().catch(() => ({}));
        if (Array.isArray(payload?.faces)) {
          faces = payload.faces as AutoTagFace[];
        }
      } catch {
        // network failure — leave faces empty
      }
      if (faces.length === 0) return;

      // Skip faces that overlap an existing tag center (within 5pp).
      const existing = faceTagsRef.current;
      const created: FaceTag[] = [];
      for (const face of faces) {
        const cx = face.leftPct + face.widthPct / 2;
        const cy = face.topPct + face.heightPct / 2;
        const overlaps = existing.some(
          (t) => Math.abs(t.x - cx) < 5 && Math.abs(t.y - cy) < 5
        );
        if (overlaps) continue;
        const color = TAG_COLORS[(existing.length + created.length) % TAG_COLORS.length];
        const tagName = face.label ?? `Person ${existing.length + created.length + 1}`;
        try {
          const res = await fetch(`/api/images/${imageId}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              label: tagName,
              contributorId: face.contributorId ?? undefined,
              userId: face.userId ?? undefined,
              leftPct: face.leftPct,
              topPct: face.topPct,
              widthPct: face.widthPct,
              heightPct: face.heightPct,
              refreshWiki: false,
            }),
          });
          const payload = await res.json().catch(() => ({}));
          if (res.ok && payload?.tag?.id) {
            // Server may have overridden the label via contributor/user data — trust it.
            const finalName = (payload.tag.label as string) || tagName;
            created.push({
              id: payload.tag.id,
              dbId: payload.tag.id,
              x: cx,
              y: cy,
              color,
              name: finalName,
            });
          }
        } catch {
          // skip this face
        }
      }
      if (created.length > 0) {
        setFaceTags((prev) => [...prev, ...created]);
        setHasChanges(true);
        void refreshPeopleSuggestions();
      }
    } finally {
      setDetectingFaces(false);
    }
  }
  // detectedFaces state predates auto-detect creating real tags; keeping
  // the no-op references so removing the visual-only outline pass below
  // doesn't trigger an unused-state lint error in dev.
  void detectedFaces;
  void setDetectedFaces;

  return (
    <>
      {coverPhotoUrl ? (
        <div
          ref={imageContainerRef}
          className="w-full rounded-xl overflow-hidden relative"
          style={{
            border: '1px solid var(--border-subtle)',
            cursor: mode === 'edit' ? 'crosshair' : 'default',
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
                    cursor: mode === 'edit' ? 'grab' : 'default',
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

      {/* Detected people indicator — edit mode only */}
      {(() => {
        if (mode !== 'edit') return null;
        const detected = detail?.analysis?.peopleObserved?.length ?? 0;
        if (detected === 0) return null;
        const tagged = faceTags.length;
        const untagged = Math.max(0, detected - tagged);
        if (untagged === 0) return null;
        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-[5px]">
              {Array.from({ length: Math.min(untagged, 5) }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-full flex-shrink-0"
                  style={{
                    width: 28,
                    height: 28,
                    border: `2.5px solid ${TAG_COLORS[(tagged + i) % TAG_COLORS.length]}`,
                    background: 'transparent',
                  }}
                />
              ))}
            </div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {untagged} {untagged === 1 ? 'person' : 'people'} detected — tap photo to tag
            </p>
          </div>
        );
      })()}

      {/* Tag list */}
      {faceTags.length > 0 ? (
        <div className="flex flex-col gap-2">
          {faceTags.map((tag) => {
            const isEditing = editingTagId === tag.id;
            const aiSuggestions = aiSuggestionsByTagId[tag.id] ?? null;
            const aiLoading = aiLoadingTagId === tag.id;
            const filterText = editingName.trim().toLowerCase();
            const filteredContributors = peopleSuggestions.filter(
              (p) => !filterText || p.name.toLowerCase().includes(filterText)
            );
            const exactMatch = peopleSuggestions.some(
              (p) => p.name.toLowerCase() === filterText && filterText.length > 0
            );
            return (
              <div
                key={tag.id}
                className="rounded-xl"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex items-center gap-3 px-4" style={{ minHeight: 44 }}>
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: tag.color }}
                  />
                  {isEditing && mode === 'edit' ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveTagName(tag.id);
                        if (e.key === 'Escape') {
                          setEditingTagId(null);
                          setEditingName('');
                        }
                      }}
                      className="flex-1 bg-transparent text-white text-sm outline-none"
                      placeholder="Type a name or pick below…"
                    />
                  ) : (
                    <span className="flex-1 text-white text-sm">
                      {tag.name || 'Unnamed'}
                    </span>
                  )}
                  {mode === 'edit' ? (
                    <>
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
                    </>
                  ) : null}
                </div>
                {isEditing && mode === 'edit' ? (
                  <div className="flex flex-col gap-1.5 px-4 pb-3 pt-1 border-t border-white/5">
                    {aiSuggestions && aiSuggestions.length > 0 ? (
                      <>
                        <div className="text-white/30 text-[10px] uppercase tracking-wider px-1 pt-1">
                          Suggested from photo
                        </div>
                        {aiSuggestions.map((s, idx) => (
                          <button
                            key={`ai-${idx}`}
                            type="button"
                            onClick={() => void handleSelectAiSuggestion(tag.id, s)}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left can-hover"
                            style={{ minHeight: 36 }}
                          >
                            <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500">
                              <Sparkles size={12} strokeWidth={2} />
                            </div>
                            <span className="text-white text-sm flex-1">{s.label}</span>
                            <span className="text-white/30 text-[10px] uppercase tracking-wide">
                              {s.confidence}
                            </span>
                          </button>
                        ))}
                      </>
                    ) : null}
                    {!aiSuggestions ? (
                      <button
                        type="button"
                        onClick={() => void loadAiSuggestionsForTag(tag)}
                        disabled={aiLoading}
                        className="self-start flex items-center gap-1.5 text-white/60 text-xs px-2 py-1.5 rounded-md disabled:opacity-50 can-hover"
                        style={{ cursor: aiLoading ? 'default' : 'pointer' }}
                      >
                        <Sparkles size={11} strokeWidth={2} />
                        {aiLoading ? 'Looking…' : 'Suggest from photo'}
                      </button>
                    ) : null}
                    {filteredContributors.length > 0 ? (
                      <>
                        <div className="text-white/30 text-[10px] uppercase tracking-wider px-1 pt-1">
                          Invited to this ember
                        </div>
                        {filteredContributors.map((p) => (
                          <button
                            key={p.contributorId}
                            type="button"
                            disabled={p.alreadyTagged}
                            onClick={() => void handleSelectContributor(tag.id, p)}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left can-hover disabled:opacity-40"
                            style={{ minHeight: 36, cursor: p.alreadyTagged ? 'default' : 'pointer' }}
                          >
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium overflow-hidden"
                              style={{
                                background: p.avatarUrl
                                  ? 'rgba(255,255,255,0.1)'
                                  : pastelForContributorIdentity({
                                      userId: p.userId,
                                      email: p.email,
                                      phoneNumber: p.phoneNumber,
                                      id: p.contributorId,
                                    }),
                                color: p.avatarUrl ? '#ffffff' : '#1f2937',
                              }}
                            >
                              {p.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                initialsFor(p.name)
                              )}
                            </div>
                            <span className="text-white text-sm flex-1">{p.name}</span>
                            {p.alreadyTagged ? (
                              <span className="text-white/30 text-[10px]">already tagged</span>
                            ) : null}
                          </button>
                        ))}
                      </>
                    ) : null}
                    {filterText && !exactMatch ? (
                      <button
                        type="button"
                        onClick={() => void handleSaveTagName(tag.id)}
                        className="self-start text-orange-500 text-xs px-2 py-1.5 can-hover"
                        style={{ cursor: 'pointer' }}
                      >
                        + Tag as &quot;{editingName.trim()}&quot;
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="flex gap-3">
        {mode === 'view' ? (
          <button
            type="button"
            onClick={() => { setMode('edit'); setHasChanges(false); setSavedMessage(''); }}
            className="w-1/2 ml-auto rounded-full px-5 text-white text-sm font-medium"
            style={{ background: '#f97316', border: 'none', minHeight: 44, cursor: 'pointer' }}
          >
            Edit
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void handleAutoDetect()}
              disabled={detectingFaces || !imageId}
              className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium btn-secondary disabled:opacity-50"
              style={{ border: '1.5px solid var(--border-btn)', minHeight: 44, cursor: detectingFaces ? 'default' : 'pointer' }}
            >
              {detectingFaces ? 'Detecting…' : 'Auto Detect'}
            </button>
            <button
              type="button"
              onClick={() => { setSavedMessage('Tagged People Saved'); setMode('view'); }}
              disabled={!hasChanges}
              className="flex-1 rounded-full px-5 text-white text-sm font-medium disabled:opacity-60"
              style={{
                background: hasChanges ? '#f97316' : 'var(--bg-surface)',
                border: hasChanges ? 'none' : '1px solid var(--border-subtle)',
                minHeight: 44,
                cursor: hasChanges ? 'pointer' : 'default',
              }}
            >
              Save
            </button>
          </>
        )}
      </div>
    </>
  );
}
