'use client';

import { useEffect, useMemo, useState } from 'react';

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

type LocationSuggestion = {
  id: string;
  label: string;
  detail: string | null;
  kind: string;
};

export default function LocationSuggestionPrompt({
  imageId,
  imageName,
  enabled,
  onApplied,
  onDismiss,
}: {
  imageId: string;
  imageName: string;
  enabled: boolean;
  onApplied: (locationLabel: string) => Promise<void> | void;
  onDismiss: () => void;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'saving'>('idle');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setSuggestions([]);
      setSelectedId('');
      setError('');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadSuggestions() {
      setStatus('loading');
      setError('');

      try {
        const response = await fetch(`/api/images/${imageId}/location-suggestions`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || 'Failed to load location suggestions');
        }

        const payload = await response.json();
        if (cancelled) {
          return;
        }

        if (payload.confirmedLocation || !Array.isArray(payload.suggestions) || payload.suggestions.length === 0) {
          onDismiss();
          return;
        }

        const nextSuggestions = payload.suggestions as LocationSuggestion[];
        setSuggestions(nextSuggestions);
        setSelectedId(nextSuggestions[0]?.id || '');
        setStatus('ready');
      } catch (loadError) {
        if (cancelled || (loadError instanceof DOMException && loadError.name === 'AbortError')) {
          return;
        }

        console.error('Location prompt failed:', loadError);
        onDismiss();
      }
    }

    void loadSuggestions();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, imageId, onDismiss]);

  const selectedSuggestion = useMemo(
    () => suggestions.find((suggestion) => suggestion.id === selectedId) || null,
    [selectedId, suggestions]
  );

  const handleConfirm = async () => {
    if (!selectedSuggestion) {
      return;
    }

    setStatus('saving');
    setError('');

    try {
      const response = await fetch(`/api/images/${imageId}/location-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: selectedSuggestion.label,
          detail: selectedSuggestion.detail,
          kind: selectedSuggestion.kind,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to save the selected location');
      }

      await onApplied(selectedSuggestion.label);
      onDismiss();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to save the selected location'
      );
      setStatus('ready');
    }
  };

  if (!enabled || status === 'idle' || status === 'loading' || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[64] bg-[rgba(17,17,17,0.45)] px-4 py-6 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div className="mx-auto flex min-h-full max-w-2xl items-center justify-center">
        <div
          className="relative w-full rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.98)] p-6 shadow-[0_24px_64px_rgba(17,17,17,0.18)] sm:p-8"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ember-line)] bg-white text-[var(--ember-text)] shadow-[0_8px_22px_rgba(17,17,17,0.08)] hover:border-[rgba(255,102,33,0.24)]"
            aria-label="Close location suggestions"
          >
            <CloseIcon />
          </button>
          <p className="ember-eyebrow">Location context</p>
          <h2 className="ember-heading mt-3 pr-12 text-3xl text-[var(--ember-text)]">
            Ember found nearby places for this photo.
          </h2>
          <p className="ember-copy mt-3 pr-12 text-sm">
            Pick the place that feels right for{' '}
            <span className="font-medium text-[var(--ember-text)]">{imageName}</span> and Ember
            will fold it into the story.
          </p>

          <div className="mt-6 grid gap-3">
            {suggestions.map((suggestion) => {
              const selected = suggestion.id === selectedId;

              return (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => setSelectedId(suggestion.id)}
                  className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${
                    selected
                      ? 'border-[var(--ember-orange-deep)] bg-[rgba(255,102,33,0.07)]'
                      : 'border-[var(--ember-line)] bg-white hover:border-[rgba(255,102,33,0.24)]'
                  }`}
                >
                  <div className="text-base font-semibold text-[var(--ember-text)]">
                    {suggestion.label}
                  </div>
                  {suggestion.detail && (
                    <p className="mt-1 text-sm text-[var(--ember-muted)]">{suggestion.detail}</p>
                  )}
                </button>
              );
            })}
          </div>

          {error && <div className="ember-status ember-status-error mt-5">{error}</div>}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={!selectedSuggestion || status === 'saving'}
              className="ember-button-primary disabled:opacity-60"
            >
              {status === 'saving' ? 'Adding location...' : 'Add to story'}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-full border border-[var(--ember-line-strong)] px-4 py-3 text-sm font-medium text-[var(--ember-text)] hover:border-[rgba(255,102,33,0.24)]"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
