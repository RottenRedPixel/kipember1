'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDuration } from '@/lib/media';
import {
  clampFaceBox,
  deriveFallbackFaceBox,
  selectFaceForPoint,
  snapFaceBoxToDetectedFace,
  tightenDetectedFaceBox,
  type FaceBox,
} from '@/lib/face-boxes';

type Tag = {
  id: string;
  label: string;
  userId: string | null;
  contributorId: string | null;
  email: string | null;
  phoneNumber: string | null;
  leftPct: number | null;
  topPct: number | null;
  widthPct: number | null;
  heightPct: number | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
  } | null;
  contributor?: {
    id: string;
    name: string | null;
    email: string | null;
    phoneNumber: string | null;
    inviteSent: boolean;
  } | null;
};

type ContributorOption = {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  userId: string | null;
};

type FriendOption = {
  id: string;
  name: string | null;
  email: string;
  phoneNumber: string | null;
};

type TagIdentityOption = {
  id: string;
  label: string;
  email: string;
  phoneNumber: string;
  userId: string | null;
  contributorId: string | null;
};

type DraftBox = {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
};

type FaceRect = FaceBox;

type MatchSuggestion = DraftBox & {
  faceIndex: number;
  label: string;
  userId: string | null;
  contributorId: string | null;
  email: string | null;
  phoneNumber: string | null;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
};

type DraftSelection = {
  label: string;
  email: string;
  phoneNumber: string;
  userId: string | null;
  contributorId: string | null;
  createContributorNow: boolean;
  sendTextNow: boolean;
};

type FaceDetectionResult = {
  boundingBox: DOMRectReadOnly;
};

type FaceDetectorInstance = {
  detect: (image: HTMLImageElement) => Promise<FaceDetectionResult[]>;
};

declare global {
  interface Window {
    FaceDetector?: new (options?: {
      fastMode?: boolean;
      maxDetectedFaces?: number;
    }) => FaceDetectorInstance;
  }
}

function boxesOverlap(left: DraftBox, right: DraftBox) {
  const xOverlap = Math.max(
    0,
    Math.min(left.leftPct + left.widthPct, right.leftPct + right.widthPct) -
      Math.max(left.leftPct, right.leftPct)
  );
  const yOverlap = Math.max(
    0,
    Math.min(left.topPct + left.heightPct, right.topPct + right.heightPct) -
      Math.max(left.topPct, right.topPct)
  );
  const overlapArea = xOverlap * yOverlap;
  const leftArea = left.widthPct * left.heightPct;

  return leftArea > 0 ? overlapArea / leftArea : 0;
}

function getSuggestionCopy(suggestion: Pick<MatchSuggestion, 'label' | 'confidence'>) {
  return suggestion.confidence === 'low'
    ? `Maybe ${suggestion.label}`
    : `Looks like ${suggestion.label}`;
}

function normalizeLabelKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function InteractiveImageTagger({
  imageId,
  mediaType,
  imageUrl,
  videoUrl,
  durationSeconds,
  imageName,
  tags,
  contributors,
  friends,
  tagIdentities,
  canManage,
  onUpdate,
}: {
  imageId: string;
  mediaType: 'IMAGE' | 'VIDEO';
  imageUrl: string | null;
  videoUrl?: string | null;
  durationSeconds?: number | null;
  imageName: string;
  tags: Tag[];
  contributors: ContributorOption[];
  friends: FriendOption[];
  tagIdentities: TagIdentityOption[];
  canManage: boolean;
  onUpdate: () => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isPickingTag, setIsPickingTag] = useState(false);
  const [detectorState, setDetectorState] = useState<'idle' | 'ready' | 'unsupported' | 'failed'>(
    'idle'
  );
  const [detectedFaces, setDetectedFaces] = useState<FaceRect[]>([]);
  const [draftBox, setDraftBox] = useState<DraftBox | null>(null);
  const [matchSuggestions, setMatchSuggestions] = useState<MatchSuggestion[]>([]);
  const [matchState, setMatchState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [draftMatchSuggestion, setDraftMatchSuggestion] = useState<MatchSuggestion | null>(null);
  const [draftMatchState, setDraftMatchState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [applyingSuggestionFaceIndex, setApplyingSuggestionFaceIndex] = useState<number | null>(null);
  const [draftSelection, setDraftSelection] = useState<DraftSelection>({
    label: '',
    email: '',
    phoneNumber: '',
    userId: null,
    contributorId: null,
    createContributorNow: false,
    sendTextNow: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const untaggedSuggestions = useMemo(() => {
    const linkedIds = new Set(
      tags.flatMap((tag) => [
        tag.userId ? `user:${tag.userId}` : '',
        tag.contributorId ? `contributor:${tag.contributorId}` : '',
        tag.label ? `label:${normalizeLabelKey(tag.label)}` : '',
      ])
    );

    const seen = new Set<string>();
    const suggestions: Array<{
      id: string;
      type: 'friend' | 'contributor' | 'tagIdentity';
      label: string;
      email: string;
      phoneNumber: string;
      userId: string | null;
      contributorId: string | null;
    }> = [];

    for (const identity of tagIdentities) {
      const identityKey =
        (identity.userId ? `user:${identity.userId}` : null) ||
        (identity.contributorId ? `contributor:${identity.contributorId}` : null) ||
        `label:${normalizeLabelKey(identity.label)}`;

      if (linkedIds.has(identityKey) || seen.has(identityKey)) {
        continue;
      }

      seen.add(identityKey);
      suggestions.push({
        id: identity.id,
        type: 'tagIdentity',
        label: identity.label,
        email: identity.email,
        phoneNumber: identity.phoneNumber,
        userId: identity.userId,
        contributorId: identity.contributorId,
      });
    }

    for (const contributor of contributors) {
      const identityKey = `contributor:${contributor.id}`;
      if (linkedIds.has(identityKey) || seen.has(identityKey)) {
        continue;
      }

      seen.add(identityKey);
      suggestions.push({
        id: contributor.id,
        type: 'contributor',
        label: contributor.name || contributor.email || 'Unnamed contributor',
        email: contributor.email || '',
        phoneNumber: contributor.phoneNumber || '',
        userId: contributor.userId,
        contributorId: contributor.id,
      });
    }

    for (const friend of friends) {
      const identityKey = `user:${friend.id}`;
      if (linkedIds.has(identityKey) || seen.has(identityKey)) {
        continue;
      }

      seen.add(identityKey);
      suggestions.push({
        id: friend.id,
        type: 'friend',
        label: friend.name || friend.email,
        email: friend.email,
        phoneNumber: friend.phoneNumber || '',
        userId: friend.id,
        contributorId: null,
      });
    }

    return suggestions.slice(0, 8);
  }, [contributors, friends, tagIdentities, tags]);

  const visibleMatchSuggestions = useMemo(
    () =>
      matchSuggestions.filter((suggestion) => {
        const alreadyCovered = tags.some((tag) => {
          if (
            tag.leftPct === null ||
            tag.topPct === null ||
            tag.widthPct === null ||
            tag.heightPct === null
          ) {
            return false;
          }

          return (
            boxesOverlap(suggestion, {
              leftPct: tag.leftPct,
              topPct: tag.topPct,
              widthPct: tag.widthPct,
              heightPct: tag.heightPct,
            }) > 0.35
          );
        });

        return !alreadyCovered;
      }),
    [matchSuggestions, tags]
  );

  useEffect(() => {
    if (!canManage || !imageUrl || !imageLoaded || !imageRef.current) {
      return;
    }

    if (typeof window === 'undefined' || !window.FaceDetector) {
      setDetectorState('unsupported');
      setDetectedFaces([]);
      return;
    }

    const FaceDetectorClass = window.FaceDetector;

    let cancelled = false;

    async function detectFaces() {
      try {
        const detector = new FaceDetectorClass({
          fastMode: true,
          maxDetectedFaces: 12,
        });
        const image = imageRef.current;
        if (!image) {
          return;
        }

        const faces = await detector.detect(image);

        if (cancelled || !image.naturalWidth || !image.naturalHeight) {
          return;
        }

        setDetectedFaces(
          faces.map((face) =>
            tightenDetectedFaceBox({
              leftPct: (face.boundingBox.x / image.naturalWidth) * 100,
              topPct: (face.boundingBox.y / image.naturalHeight) * 100,
              widthPct: (face.boundingBox.width / image.naturalWidth) * 100,
              heightPct: (face.boundingBox.height / image.naturalHeight) * 100,
            })
          )
        );
        setDetectorState('ready');
      } catch (detectionError) {
        console.error('Face detection failed:', detectionError);
        if (!cancelled) {
          setDetectorState('failed');
          setDetectedFaces([]);
        }
      }
    }

    void detectFaces();

    return () => {
      cancelled = true;
    };
  }, [canManage, imageLoaded, imageUrl]);

  useEffect(() => {
    if (!canManage || !imageUrl || !imageLoaded || detectedFaces.length === 0) {
      setMatchSuggestions([]);
      setMatchState('idle');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadSuggestions() {
      setMatchState('loading');

      try {
        const response = await fetch(`/api/images/${imageId}/tag-suggestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            faces: detectedFaces,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to load tag suggestions');
        }

        const payload = await response.json();
        if (cancelled) {
          return;
        }

        setMatchSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
        setMatchState('ready');
      } catch (suggestionError) {
        if (cancelled || (suggestionError instanceof DOMException && suggestionError.name === 'AbortError')) {
          return;
        }

        console.error('Tag suggestion lookup failed:', suggestionError);
        setMatchSuggestions([]);
        setMatchState('failed');
      }
    }

    void loadSuggestions();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [canManage, detectedFaces, imageId, imageLoaded, imageUrl]);

  useEffect(() => {
    if (!canManage || !draftBox) {
      setDraftMatchSuggestion(null);
      setDraftMatchState('idle');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadDraftSuggestion() {
      setDraftMatchState('loading');

      try {
        const response = await fetch(`/api/images/${imageId}/tag-suggestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            faces: [draftBox],
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to load draft suggestion');
        }

        const payload = await response.json();
        if (cancelled) {
          return;
        }

        const suggestion =
          Array.isArray(payload.suggestions) && payload.suggestions.length > 0
            ? payload.suggestions[0]
            : null;

        setDraftMatchSuggestion(suggestion);
        setDraftMatchState('ready');

        if (suggestion) {
          setDraftSelection((current) => ({
            ...current,
            label: current.label || suggestion.label,
            email: current.email || suggestion.email || '',
            phoneNumber: current.phoneNumber || suggestion.phoneNumber || '',
            userId: current.userId || suggestion.userId,
            contributorId: current.contributorId || suggestion.contributorId,
          }));
        }
      } catch (suggestionError) {
        if (cancelled || (suggestionError instanceof DOMException && suggestionError.name === 'AbortError')) {
          return;
        }

        console.error('Draft tag suggestion lookup failed:', suggestionError);
        setDraftMatchSuggestion(null);
        setDraftMatchState('failed');
      }
    }

    void loadDraftSuggestion();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [canManage, draftBox, imageId]);

  const resetDraft = () => {
    setDraftBox(null);
    setDraftMatchSuggestion(null);
    setDraftMatchState('idle');
    setDraftSelection({
      label: '',
      email: '',
      phoneNumber: '',
      userId: null,
      contributorId: null,
      createContributorNow: false,
      sendTextNow: false,
    });
    setError('');
  };

  const applyMatchSuggestion = async (suggestion: MatchSuggestion) => {
    setApplyingSuggestionFaceIndex(suggestion.faceIndex);
    setError('');

    const snappedBox =
      detectedFaces.length > 0
        ? snapFaceBoxToDetectedFace(suggestion, detectedFaces)
        : clampFaceBox(suggestion);

    try {
      const response = await fetch(`/api/images/${imageId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: suggestion.label,
          email: suggestion.email,
          phoneNumber: suggestion.phoneNumber,
          userId: suggestion.userId,
          contributorId: suggestion.contributorId,
          leftPct: snappedBox.leftPct,
          topPct: snappedBox.topPct,
          widthPct: snappedBox.widthPct,
          heightPct: snappedBox.heightPct,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save suggested tag');
      }

      setMatchSuggestions((current) =>
        current.filter((item) => item.faceIndex !== suggestion.faceIndex)
      );
      onUpdate();
    } catch (suggestionError) {
      setError(
        suggestionError instanceof Error
          ? suggestionError.message
          : 'Failed to save suggested tag'
      );
    } finally {
      setApplyingSuggestionFaceIndex(null);
    }
  };

  const handleSurfaceClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canManage || !imageUrl || !isPickingTag || !imageRef.current) {
      return;
    }

    const rect = imageRef.current.getBoundingClientRect();
    const xPct = ((event.clientX - rect.left) / rect.width) * 100;
    const yPct = ((event.clientY - rect.top) / rect.height) * 100;
    const box =
      detectedFaces.length > 0
        ? selectFaceForPoint(xPct, yPct, detectedFaces)
        : deriveFallbackFaceBox(xPct, yPct);

    setDraftBox(box);
    setIsPickingTag(false);
    setError('');
  };

  const applySuggestion = (
    suggestion:
      | {
          id: string;
          type: 'friend' | 'contributor' | 'tagIdentity';
          label: string;
          email: string;
          phoneNumber: string;
          userId: string | null;
          contributorId: string | null;
        }
      | null
  ) => {
    if (!suggestion) {
      return;
    }

    setDraftSelection((current) => ({
      ...current,
      label: suggestion.label,
      email: suggestion.email,
      phoneNumber: suggestion.phoneNumber,
      userId: suggestion.userId,
      contributorId:
        suggestion.type === 'contributor'
          ? suggestion.id
          : suggestion.contributorId,
    }));
  };

  const createTag = async () => {
    if (!draftBox || !draftSelection.label.trim()) {
      setError('Add a name for this tag before saving it.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/images/${imageId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: draftSelection.label.trim(),
          email: draftSelection.email.trim() || null,
          phoneNumber: draftSelection.phoneNumber.trim() || null,
          userId: draftSelection.userId,
          contributorId: draftSelection.contributorId,
          leftPct: draftBox.leftPct,
          topPct: draftBox.topPct,
          widthPct: draftBox.widthPct,
          heightPct: draftBox.heightPct,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create tag');
      }

      if (draftSelection.createContributorNow || draftSelection.sendTextNow) {
        const inviteResponse = await fetch(`/api/images/${imageId}/tags/${payload.tag.id}/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sendText: draftSelection.sendTextNow,
          }),
        });

        const invitePayload = await inviteResponse.json();

        if (!inviteResponse.ok) {
          throw new Error(invitePayload.error || 'Failed to invite tagged person');
        }
      }

      resetDraft();
      onUpdate();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create tag');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="ember-eyebrow">
            Face tags
          </p>
          <p className="ember-copy mt-1 text-sm">
            Pin people directly on the photo and optionally turn the tag into an invite.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="ember-chip text-[var(--ember-muted)]">
              {detectorState === 'ready'
                ? `${detectedFaces.length} faces detected`
                : detectorState === 'unsupported'
                  ? 'Face snapping unavailable'
                  : detectorState === 'failed'
                    ? 'Face snapping failed'
                    : 'Face detection loading'}
            </span>
            {matchState === 'loading' && (
              <span className="ember-chip text-[var(--ember-muted)]">
                Looking for known people...
              </span>
            )}
            {matchState === 'ready' && visibleMatchSuggestions.length > 0 && (
              <span className="ember-chip text-[var(--ember-orange-deep)]">
                {visibleMatchSuggestions.length} likely match
                {visibleMatchSuggestions.length === 1 ? '' : 'es'}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setIsPickingTag((current) => !current);
                setError('');
              }}
              disabled={!imageUrl}
              className={`min-h-0 px-4 py-2 ${isPickingTag ? 'ember-button-secondary text-[var(--ember-orange-deep)]' : 'ember-button-primary'} ${
                isPickingTag
                  ? ''
                  : ''
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isPickingTag ? 'Cancel tagging' : 'Tag a face'}
            </button>
          </div>
        )}
      </div>

      <div className="ember-card overflow-hidden rounded-[2rem] p-4">
        {mediaType === 'VIDEO' && videoUrl && (
          <div className="mb-4 overflow-hidden rounded-[1.6rem] border border-[var(--ember-line)] bg-[var(--ember-charcoal)]">
            <video
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              poster={imageUrl || undefined}
              className="max-h-[40rem] w-full object-contain"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-3 text-sm text-[var(--ember-muted)]">
              <span>Face tags on videos are pinned to the poster frame.</span>
              {formatDuration(durationSeconds) && (
                <span className="ember-chip">
                  {formatDuration(durationSeconds)}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-center">
          {imageUrl ? (
            <div
              role="button"
              tabIndex={canManage && isPickingTag ? 0 : -1}
              onClick={handleSurfaceClick}
              aria-disabled={!canManage || !isPickingTag}
              className={`relative inline-block max-w-full overflow-hidden rounded-[1.6rem] ${
                isPickingTag ? 'cursor-crosshair' : 'cursor-default'
              }`}
            >
              <img
                ref={imageRef}
                src={imageUrl}
                alt={imageName}
                onLoad={() => setImageLoaded(true)}
                className="block max-h-[42rem] w-auto max-w-full rounded-[1.6rem] object-contain"
              />

              <div className="pointer-events-none absolute inset-0">
                {detectedFaces.map((face, index) => (
                  <div
                    key={`face-${index}`}
                    className={`absolute rounded-[1rem] border ${
                      isPickingTag
                        ? 'border-[rgba(255,102,33,0.5)] bg-[rgba(255,102,33,0.08)]'
                        : 'border-transparent'
                    }`}
                    style={{
                      left: `${clampFaceBox(face).leftPct}%`,
                      top: `${clampFaceBox(face).topPct}%`,
                      width: `${clampFaceBox(face).widthPct}%`,
                      height: `${clampFaceBox(face).heightPct}%`,
                    }}
                  />
                ))}

                {tags
                  .filter(
                    (tag) =>
                      tag.leftPct !== null &&
                      tag.topPct !== null &&
                      tag.widthPct !== null &&
                      tag.heightPct !== null
                  )
                  .map((tag) => (
                    <div
                      key={tag.id}
                      className="absolute rounded-[1rem] border-2 border-[var(--ember-orange)] bg-[rgba(255,102,33,0.08)]"
                      style={{
                        left: `${tag.leftPct}%`,
                        top: `${tag.topPct}%`,
                        width: `${tag.widthPct}%`,
                        height: `${tag.heightPct}%`,
                      }}
                    >
                      <div className="absolute left-2 top-2 inline-flex rounded-full bg-white/96 px-3 py-1 text-xs font-semibold text-[var(--ember-text)] shadow-sm">
                        {tag.label}
                      </div>
                    </div>
                  ))}

                {draftBox && (
                  <div
                    className="absolute rounded-[1rem] border-2 border-[var(--ember-orange)] bg-[rgba(255,102,33,0.08)]"
                    style={{
                      left: `${draftBox.leftPct}%`,
                      top: `${draftBox.topPct}%`,
                      width: `${draftBox.widthPct}%`,
                      height: `${draftBox.heightPct}%`,
                    }}
                  >
                    <div className="absolute left-2 top-2 inline-flex rounded-full bg-white/96 px-3 py-1 text-xs font-semibold text-[var(--ember-text)] shadow-sm">
                      New tag
                    </div>
                  </div>
                )}

                {visibleMatchSuggestions.map((suggestion) => (
                  <div
                    key={`suggestion-${suggestion.faceIndex}-${suggestion.label}`}
                    className="absolute rounded-[1rem] border-2 border-[rgba(255,102,33,0.45)] bg-[rgba(255,102,33,0.08)]"
                    style={{
                      left: `${suggestion.leftPct}%`,
                      top: `${suggestion.topPct}%`,
                      width: `${suggestion.widthPct}%`,
                      height: `${suggestion.heightPct}%`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => void applyMatchSuggestion(suggestion)}
                      title={suggestion.reason}
                      className="pointer-events-auto absolute bottom-2 left-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-full bg-white/96 px-3 py-1 text-left text-xs font-semibold text-[var(--ember-text)] shadow-sm transition hover:bg-white"
                    >
                      <span className="truncate">
                        {applyingSuggestionFaceIndex === suggestion.faceIndex
                          ? 'Saving...'
                          : getSuggestionCopy(suggestion)}
                      </span>
                      <span className="rounded-full bg-[rgba(255,102,33,0.12)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--ember-orange-deep)]">
                        {suggestion.confidence}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex max-w-xl flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-[var(--ember-line-strong)] bg-white px-8 py-10 text-center text-sm text-[var(--ember-muted)]">
              <div className="font-semibold text-[var(--ember-text)]">Poster frame unavailable</div>
              <p className="mt-2">
                This video uploaded successfully, but Ember could not generate a still frame for face tagging on the server.
              </p>
            </div>
          )}
        </div>

        {isPickingTag && canManage && imageUrl && (
          <p className="mt-4 text-center text-sm text-[var(--ember-muted)]">
            Click the person&apos;s face on the {mediaType === 'VIDEO' ? 'poster frame' : 'photo'}.
            Ember will snap to a detected face when possible.
          </p>
        )}
      </div>

      {draftBox && (
        <div className="ember-panel rounded-[2rem] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="ember-heading text-2xl text-[var(--ember-text)]">Create face tag</h3>
              <p className="ember-copy mt-1 text-sm">
                Save the tag, or turn it into a contributor invite right away.
              </p>
            </div>
            <button
              type="button"
              onClick={resetDraft}
              className="text-sm font-medium text-[var(--ember-muted)] transition hover:text-[var(--ember-text)]"
            >
              Cancel
            </button>
          </div>

          {untaggedSuggestions.length > 0 && (
            <div className="mt-4">
              <p className="ember-eyebrow">
                Quick picks
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {untaggedSuggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.type}-${suggestion.id}`}
                    type="button"
                    onClick={() => applySuggestion(suggestion)}
                    className="ember-button-secondary min-h-0 px-4 py-2"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {draftMatchState === 'loading' && (
            <div className="mt-4 ember-chip text-[var(--ember-muted)]">
              Checking for a likely match...
            </div>
          )}

          {draftMatchSuggestion && (
            <button
              type="button"
              onClick={() =>
                setDraftSelection((current) => ({
                  ...current,
                  label: draftMatchSuggestion.label,
                  email: draftMatchSuggestion.email || '',
                  phoneNumber: draftMatchSuggestion.phoneNumber || '',
                  userId: draftMatchSuggestion.userId,
                  contributorId: draftMatchSuggestion.contributorId,
                }))
              }
              className="mt-4 ember-card flex w-full items-start justify-between gap-3 rounded-[1.5rem] px-4 py-4 text-left transition hover:border-[rgba(255,102,33,0.24)]"
            >
              <div>
                <div className="text-sm font-semibold text-[var(--ember-text)]">
                  {getSuggestionCopy(draftMatchSuggestion)}
                </div>
                <p className="mt-1 text-sm text-[var(--ember-muted)]">
                  {draftMatchSuggestion.reason}
                </p>
              </div>
              <span className="rounded-full bg-[rgba(255,102,33,0.12)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ember-orange-deep)]">
                {draftMatchSuggestion.confidence}
              </span>
            </button>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-[var(--ember-text)]">
              <div className="mb-2 font-medium">Name</div>
              <input
                type="text"
                value={draftSelection.label}
                onChange={(event) =>
                  setDraftSelection((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                placeholder="Who is this?"
                className="ember-input"
              />
            </label>
            <label className="text-sm text-[var(--ember-text)]">
              <div className="mb-2 font-medium">Email</div>
              <input
                type="email"
                value={draftSelection.email}
                onChange={(event) =>
                  setDraftSelection((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="name@example.com"
                className="ember-input"
              />
            </label>
            <label className="text-sm text-[var(--ember-text)]">
              <div className="mb-2 font-medium">Phone</div>
              <input
                type="tel"
                value={draftSelection.phoneNumber}
                onChange={(event) =>
                  setDraftSelection((current) => ({
                    ...current,
                    phoneNumber: event.target.value,
                  }))
                }
                placeholder="5551234567"
                className="ember-input"
              />
            </label>
            <div className="rounded-[1.4rem] border border-[var(--ember-line)] bg-white px-4 py-4">
              <label className="flex items-center gap-3 text-sm text-[var(--ember-text)]">
                <input
                  type="checkbox"
                  checked={draftSelection.createContributorNow}
                  onChange={(event) =>
                    setDraftSelection((current) => ({
                      ...current,
                      createContributorNow: event.target.checked,
                      sendTextNow: event.target.checked ? current.sendTextNow : false,
                    }))
                  }
                  className="h-4 w-4 rounded border-[var(--ember-line-strong)] text-[var(--ember-orange)]"
                />
                Add this tagged person as a contributor now
              </label>
              <label className="mt-3 flex items-center gap-3 text-sm text-[var(--ember-text)]">
                <input
                  type="checkbox"
                  checked={draftSelection.sendTextNow}
                  onChange={(event) =>
                    setDraftSelection((current) => ({
                      ...current,
                      sendTextNow: event.target.checked,
                      createContributorNow: event.target.checked ? true : current.createContributorNow,
                    }))
                  }
                  className="h-4 w-4 rounded border-[var(--ember-line-strong)] text-[var(--ember-orange)]"
                />
                Send a text invite right away
              </label>
            </div>
          </div>

          {error && (
            <div className="ember-status ember-status-error mt-4">
              {error}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void createTag()}
              disabled={saving}
              className="ember-button-primary disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save tag'}
            </button>
            <span className="text-sm text-[var(--ember-muted)]">
              If a phone number is present, the invite can text them immediately.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
