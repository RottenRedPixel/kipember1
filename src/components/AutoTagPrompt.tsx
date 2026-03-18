'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  snapFaceBoxToDetectedFace,
  tightenDetectedFaceBox,
  type FaceBox,
} from '@/lib/face-boxes';

type MatchSuggestion = {
  faceIndex: number;
  label: string;
  userId: string | null;
  contributorId: string | null;
  email: string | null;
  phoneNumber: string | null;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
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

function joinLabels(labels: string[]) {
  if (labels.length === 0) {
    return 'someone you know';
  }

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

export default function AutoTagPrompt({
  imageId,
  imageName,
  mediaUrl,
  enabled,
  existingTagCount,
  onApplied,
  onDismiss,
}: {
  imageId: string;
  imageName: string;
  mediaUrl: string | null;
  enabled: boolean;
  existingTagCount: number;
  onApplied: (labels: string[]) => Promise<void> | void;
  onDismiss: () => void;
}) {
  const [status, setStatus] = useState<'idle' | 'detecting' | 'matching' | 'ready' | 'applying'>('idle');
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [detectedFaces, setDetectedFaces] = useState<FaceBox[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled || !mediaUrl) {
      setDetectedFaces([]);
      return;
    }

    if (typeof window === 'undefined' || !window.FaceDetector) {
      setDetectedFaces([]);
      return;
    }

    const FaceDetectorClass = window.FaceDetector;
    const imageSrc = mediaUrl;
    let cancelled = false;

    async function detectFaces() {
      try {
        const image = new window.Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('Failed to load image for face detection'));
          image.src = imageSrc;
        });

        const detector = new FaceDetectorClass({
          fastMode: true,
          maxDetectedFaces: 12,
        });
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
      } catch (detectionError) {
        if (!cancelled) {
          console.error('Auto-tag face detection failed:', detectionError);
          setDetectedFaces([]);
        }
      }
    }

    void detectFaces();

    return () => {
      cancelled = true;
    };
  }, [enabled, mediaUrl]);

  useEffect(() => {
    if (!enabled || !mediaUrl || existingTagCount > 0) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadSuggestions() {
      setStatus('matching');

      try {
        const response = await fetch(`/api/images/${imageId}/tag-suggestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoDetect: true }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to check for familiar faces');
        }

        const payload = await response.json();
        if (cancelled) {
          return;
        }

        const nextSuggestions = Array.isArray(payload.suggestions)
          ? (payload.suggestions as MatchSuggestion[])
          : [];

        if (nextSuggestions.length === 0) {
          onDismiss();
          return;
        }

        setSuggestions(nextSuggestions);
        setStatus('ready');
      } catch (loadError) {
        if (cancelled || (loadError instanceof DOMException && loadError.name === 'AbortError')) {
          return;
        }

        console.error('Auto-tag prompt failed:', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Failed to check for familiar faces');
        onDismiss();
      }
    }

    void loadSuggestions();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, existingTagCount, imageId, mediaUrl, onDismiss]);

  const labelList = useMemo(
    () => Array.from(new Set(suggestions.map((suggestion) => suggestion.label))).slice(0, 4),
    [suggestions]
  );

  const snappedSuggestions = useMemo(
    () =>
      suggestions.map((suggestion) => {
        if (detectedFaces.length === 0) {
          return suggestion;
        }

        const snappedBox = snapFaceBoxToDetectedFace(suggestion, detectedFaces);
        return {
          ...suggestion,
          ...snappedBox,
        };
      }),
    [detectedFaces, suggestions]
  );

  const handleAutoTag = async () => {
    if (snappedSuggestions.length === 0) {
      onDismiss();
      return;
    }

    setStatus('applying');
    setError('');

    try {
      const results = await Promise.allSettled(
        snappedSuggestions.map(async (suggestion) => {
          const response = await fetch(`/api/images/${imageId}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              label: suggestion.label,
              email: suggestion.email,
              phoneNumber: suggestion.phoneNumber,
              userId: suggestion.userId,
              contributorId: suggestion.contributorId,
              leftPct: suggestion.leftPct,
              topPct: suggestion.topPct,
              widthPct: suggestion.widthPct,
              heightPct: suggestion.heightPct,
            }),
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error || `Failed to auto-tag ${suggestion.label}`);
          }

          return suggestion.label;
        })
      );

      const savedLabels = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
        .map((result) => result.value);

      if (savedLabels.length === 0) {
        throw new Error('Ember could not save the suggested tags');
      }

      await onApplied(Array.from(new Set(savedLabels)));
      onDismiss();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Failed to auto-tag people');
      setStatus('ready');
    }
  };

  if (!enabled || status === 'idle' || status === 'detecting' || status === 'matching' || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[65] bg-[rgba(17,17,17,0.45)] px-4 py-6 backdrop-blur-sm" onClick={onDismiss}>
      <div className="mx-auto flex min-h-full max-w-xl items-center justify-center">
        <div
          className="w-full rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.98)] p-6 shadow-[0_24px_64px_rgba(17,17,17,0.18)] sm:p-8"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="ember-eyebrow">Familiar faces</p>
          <h2 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">
            It looks like {joinLabels(labelList)} {labelList.length === 1 ? 'is' : 'are'} in this photo.
          </h2>
          <p className="ember-copy mt-3 text-sm">
            Want Ember to auto-tag {labelList.length === 1 ? 'that person' : 'them'} on{' '}
            <span className="font-medium text-[var(--ember-text)]">{imageName}</span>?
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {labelList.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full bg-[rgba(255,102,33,0.1)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ember-orange-deep)]"
              >
                {label}
              </span>
            ))}
          </div>

          {error && <div className="ember-status ember-status-error mt-5">{error}</div>}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleAutoTag()}
              disabled={status === 'applying'}
              className="ember-button-primary disabled:opacity-60"
            >
              {status === 'applying' ? 'Auto-tagging...' : 'Auto-tag them'}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-full border border-[var(--ember-line-strong)] px-4 py-3 text-sm font-medium text-[var(--ember-text)] hover:border-[rgba(255,102,33,0.24)]"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
