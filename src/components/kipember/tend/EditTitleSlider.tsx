'use client';

import { Lightbulb, TicketSlash, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

type TitleQuoteSuggestion = {
  title: string;
  contributorName: string;
  quote: string;
  source: 'voice' | 'text';
};

type TitleSuggestionResponse = {
  analysisSuggestions: string[];
  contextSuggestions: string[];
  contributorQuotes: TitleQuoteSuggestion[];
  suggestions: string[];
};

type TitleDetail = {
  title: string | null;
  titleUpdatedAt?: string | Date | null;
  createdAt?: string | Date | null;
  originalName?: string | null;
  tags?: Array<{ id: string; label: string }>;
};

function stripExtension(value: string | null | undefined) {
  return (value || '').replace(/\.[^.]+$/, '');
}

function WikiCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-4 py-3.5 flex flex-col gap-1"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      {children}
    </div>
  );
}

export default function EditTitleSlider({
  detail,
  imageId,
  refreshDetail,
  onStatus,
}: {
  detail: TitleDetail | null;
  imageId: string | null;
  refreshDetail: () => Promise<unknown>;
  onStatus?: (message: string) => void;
}) {
  const [titleValue, setTitleValue] = useState('');
  const [suggestions, setSuggestions] = useState<TitleSuggestionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [preferredPeopleIds, setPreferredPeopleIds] = useState<Set<string>>(new Set());

  // Sync the input value from the loaded detail.
  useEffect(() => {
    if (!detail) return;
    setTitleValue(detail.title || stripExtension(detail.originalName) || '');
  }, [detail]);

  // Load suggestions whenever the slider opens for a new ember.
  useEffect(() => {
    if (!imageId) {
      setSuggestions(null);
      setLoading(false);
      setRefreshing(false);
      setError('');
      return;
    }

    let cancelled = false;

    async function loadSuggestions() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(
          `/api/images/${imageId}/title-suggestions`,
          { cache: 'no-store' }
        );
        const payload = (await response.json().catch(() => null)) as
          | TitleSuggestionResponse
          | { error?: string }
          | null;

        if (cancelled) return;

        if (!response.ok || !payload || !('suggestions' in payload)) {
          setSuggestions(null);
          setError(
            payload && 'error' in payload
              ? payload.error || 'Failed to load title suggestions.'
              : 'Failed to load title suggestions.'
          );
          return;
        }

        setSuggestions(payload);
      } catch (loadError) {
        if (!cancelled) {
          setSuggestions(null);
          setError(
            loadError instanceof Error ? loadError.message : 'Failed to load title suggestions.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [imageId]);

  async function handleRegenIdeas() {
    if (!imageId) return;

    setRefreshing(true);
    setError('');
    try {
      const params = new URLSearchParams({ refresh: '1' });
      const preferredNames = (detail?.tags || [])
        .filter((tag) => preferredPeopleIds.has(tag.id))
        .map((tag) => tag.label)
        .filter(Boolean);
      if (preferredNames.length > 0) params.set('preferredPeople', preferredNames.join(','));
      const response = await fetch(
        `/api/images/${imageId}/title-suggestions?${params.toString()}`,
        { cache: 'no-store' }
      );
      const payload = (await response.json().catch(() => null)) as
        | TitleSuggestionResponse
        | { error?: string }
        | null;

      if (!response.ok || !payload || !('suggestions' in payload)) {
        setSuggestions(null);
        setError(
          payload && 'error' in payload
            ? payload.error || 'Failed to refresh title suggestions.'
            : 'Failed to refresh title suggestions.'
        );
        return;
      }

      setSuggestions(payload);
      onStatus?.('Title suggestions refreshed.');
    } catch (refreshError) {
      setError(
        refreshError instanceof Error ? refreshError.message : 'Failed to refresh title suggestions.'
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSave() {
    if (!imageId) return;
    const response = await fetch(`/api/images/${imageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleValue }),
    });
    onStatus?.(response.ok ? 'Title saved.' : 'Failed to save title.');
    await refreshDetail();
  }

  const savedTitleValue = detail
    ? detail.title || stripExtension(detail.originalName) || ''
    : '';
  const isDirty = titleValue.trim() !== savedTitleValue.trim();
  const updatedAtLabel = detail?.titleUpdatedAt || detail?.createdAt || null;

  return (
    <>
      {/* Ember title input */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <TicketSlash size={17} color="var(--text-secondary)" strokeWidth={1.6} />
          <h3 className="text-white font-medium text-base">Title</h3>
        </div>
        <div
          className="rounded-xl px-4 py-3.5 flex flex-col gap-1"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <input
            value={titleValue}
            onChange={(event) => setTitleValue(event.target.value.slice(0, 40))}
            placeholder="Ember title"
            maxLength={40}
            className="w-full px-0 py-2 text-base font-medium text-white placeholder-white/30 outline-none bg-transparent"
          />
          {updatedAtLabel ? (
            <p className="text-white/30 text-xs mt-1 border-t border-white/10 pt-2">
              {detail?.titleUpdatedAt ? 'Last updated' : 'Created'}:{' '}
              {new Date(updatedAtLabel).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          ) : null}
        </div>
      </div>

      {/* Smart title suggestions */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--text-secondary)' }}>
            <Lightbulb size={17} />
          </span>
          <h3 className="text-white font-medium text-base">Title Ideas</h3>
        </div>
        <WikiCard>
          {loading ? <p className="text-white/45 text-sm">Loading suggestions...</p> : null}

          {error ? <p className="text-white/45 text-sm">{error}</p> : null}

          {!loading && !error && suggestions ? (
            <div className="flex flex-col gap-4">
              {[...suggestions.analysisSuggestions, ...suggestions.contextSuggestions].length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {[...suggestions.analysisSuggestions, ...suggestions.contextSuggestions].map(
                    (suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setTitleValue(suggestion)}
                        className="rounded-full px-3 py-2 text-sm text-white text-left can-hover"
                        style={{
                          background:
                            titleValue.trim().toLowerCase() === suggestion.trim().toLowerCase()
                              ? 'rgba(249,115,22,0.22)'
                              : 'rgba(255,255,255,0.05)',
                          border:
                            titleValue.trim().toLowerCase() === suggestion.trim().toLowerCase()
                              ? '1px solid rgba(249,115,22,0.7)'
                              : '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {suggestion}
                      </button>
                    )
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </WikiCard>
      </div>

      {/* People hints */}
      {detail?.tags && detail.tags.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--text-secondary)' }}>
              <Users size={17} />
            </span>
            <h3 className="text-white font-medium text-base">People</h3>
          </div>
          <WikiCard>
            <div className="flex flex-col gap-2">
              {detail.tags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-3 cursor-pointer"
                  style={{ minHeight: 36 }}
                >
                  <input
                    type="checkbox"
                    checked={preferredPeopleIds.has(tag.id)}
                    onChange={(e) => {
                      setPreferredPeopleIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(tag.id);
                        else next.delete(tag.id);
                        return next;
                      });
                    }}
                    className="accent-orange-500 w-4 h-4 shrink-0"
                  />
                  <span className="text-white text-sm">{tag.label}</span>
                </label>
              ))}
            </div>
            <p className="text-white/30 text-xs mt-1 border-t border-white/10 pt-2">
              Check names to prefer in title suggestions.
            </p>
          </WikiCard>
        </div>
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => void handleRegenIdeas()}
          disabled={refreshing || loading}
          className="flex-1 rounded-full px-5 text-white text-sm font-medium btn-secondary disabled:opacity-60 cursor-pointer"
          style={{ border: '1.5px solid var(--border-btn)', minHeight: 44 }}
        >
          {refreshing ? 'Regenerating...' : 'Regen Ideas'}
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!isDirty}
          className="flex-1 rounded-full px-5 text-white text-sm font-medium disabled:opacity-60"
          style={{
            background: isDirty ? '#f97316' : 'var(--bg-surface)',
            border: isDirty ? 'none' : '1px solid var(--border-subtle)',
            minHeight: 44,
            cursor: isDirty ? 'pointer' : 'default',
          }}
        >
          Save
        </button>
      </div>
    </>
  );
}
