'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDuration } from '@/lib/media';

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

type DraftBox = {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
};

type FaceRect = DraftBox;

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

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function clampBox(box: DraftBox): DraftBox {
  const widthPct = Math.max(8, Math.min(30, box.widthPct));
  const heightPct = Math.max(8, Math.min(34, box.heightPct));

  return {
    leftPct: clampPercentage(Math.min(box.leftPct, 100 - widthPct)),
    topPct: clampPercentage(Math.min(box.topPct, 100 - heightPct)),
    widthPct,
    heightPct,
  };
}

function deriveFallbackBox(xPct: number, yPct: number): DraftBox {
  return clampBox({
    leftPct: xPct - 7,
    topPct: yPct - 9,
    widthPct: 14,
    heightPct: 18,
  });
}

function selectNearestFace(xPct: number, yPct: number, faces: FaceRect[]): DraftBox {
  const containingFace = faces.find(
    (face) =>
      xPct >= face.leftPct &&
      xPct <= face.leftPct + face.widthPct &&
      yPct >= face.topPct &&
      yPct <= face.topPct + face.heightPct
  );

  if (containingFace) {
    return clampBox(containingFace);
  }

  let nearest: FaceRect | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const face of faces) {
    const centerX = face.leftPct + face.widthPct / 2;
    const centerY = face.topPct + face.heightPct / 2;
    const distance = Math.hypot(centerX - xPct, centerY - yPct);

    if (distance < nearestDistance) {
      nearest = face;
      nearestDistance = distance;
    }
  }

  if (nearest && nearestDistance <= 18) {
    return clampBox(nearest);
  }

  return deriveFallbackBox(xPct, yPct);
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
      ])
    );

    return [
      ...contributors
        .filter((contributor) => !linkedIds.has(`contributor:${contributor.id}`))
        .map((contributor) => ({
          id: contributor.id,
          type: 'contributor' as const,
          label: contributor.name || contributor.email || 'Unnamed contributor',
          email: contributor.email || '',
          phoneNumber: contributor.phoneNumber || '',
          userId: contributor.userId,
        })),
      ...friends
        .filter((friend) => !linkedIds.has(`user:${friend.id}`))
        .map((friend) => ({
          id: friend.id,
          type: 'friend' as const,
          label: friend.name || friend.email,
          email: friend.email,
          phoneNumber: friend.phoneNumber || '',
          userId: friend.id,
        })),
    ].slice(0, 8);
  }, [contributors, friends, tags]);

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
            clampBox({
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

  const resetDraft = () => {
    setDraftBox(null);
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

  const handleSurfaceClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!canManage || !imageUrl || !isPickingTag || !imageRef.current) {
      return;
    }

    const rect = imageRef.current.getBoundingClientRect();
    const xPct = ((event.clientX - rect.left) / rect.width) * 100;
    const yPct = ((event.clientY - rect.top) / rect.height) * 100;
    const box =
      detectedFaces.length > 0
        ? selectNearestFace(xPct, yPct, detectedFaces)
        : deriveFallbackBox(xPct, yPct);

    setDraftBox(box);
    setIsPickingTag(false);
    setError('');
  };

  const applySuggestion = (
    suggestion:
      | {
          id: string;
          type: 'friend' | 'contributor';
          label: string;
          email: string;
          phoneNumber: string;
          userId: string | null;
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
      userId: suggestion.type === 'friend' ? suggestion.userId : suggestion.userId,
      contributorId: suggestion.type === 'contributor' ? suggestion.id : null,
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
            <button
              type="button"
              onClick={handleSurfaceClick}
              disabled={!canManage || !isPickingTag}
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
                      left: `${face.leftPct}%`,
                      top: `${face.topPct}%`,
                      width: `${face.widthPct}%`,
                      height: `${face.heightPct}%`,
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
              </div>
            </button>
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
