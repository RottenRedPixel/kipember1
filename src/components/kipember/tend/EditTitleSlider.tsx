'use client';

import { Lightbulb, TicketSlash, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

type TitleSuggestionResponse = {
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
  // The slider opens in 'view' mode showing only the title block. Clicking
  // Edit reveals Title Ideas + People and unlocks the input. After a
  // successful save we snap back to 'view'.
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Sync the input value from the loaded detail. Also default the people
  // checklist to "all selected" so the first batch of ideas already follows
  // everyone tagged in the photo. Re-opening the slider always lands back
  // in view mode.
  useEffect(() => {
    if (!detail) return;
    setTitleValue(detail.title || stripExtension(detail.originalName) || '');
    setPreferredPeopleIds(new Set((detail.tags || []).map((tag) => tag.id)));
    setMode('view');
  }, [detail]);

  // Load suggestions whenever the slider opens for a new ember. Pass the
  // currently-checked people so the cache key matches and the initial ideas
  // already feature everyone tagged.
  useEffect(() => {
    if (!imageId || !detail) {
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
        const params = new URLSearchParams();
        const preferredNames = (detail?.tags || [])
          .filter((tag) => preferredPeopleIds.has(tag.id))
          .map((tag) => tag.label)
          .filter(Boolean);
        if (preferredNames.length > 0) params.set('preferredPeople', preferredNames.join(','));
        const query = params.toString();
        const response = await fetch(
          `/api/images/${imageId}/title-suggestions${query ? `?${query}` : ''}`,
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
    // We deliberately do NOT depend on preferredPeopleIds — the initial load
    // uses whatever the slider was opened with (defaults to all). After the
    // user toggles people they re-fetch via the Regen Ideas button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId, detail]);

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
    if (response.ok) setMode('view');
    await refreshDetail();
  }

  const savedTitleValue = detail
    ? detail.title || stripExtension(detail.originalName) || ''
    : '';
  const isDirty = titleValue.trim() !== savedTitleValue.trim();
  const updatedAtLabel = detail?.titleUpdatedAt || detail?.createdAt || null;

  // Match the Snapshot slider — wait for the ember to load before rendering
  // the form so the title input, ideas card, and People list all appear at
  // once instead of the People section popping in after the title input.
  if (!detail || !imageId) {
    return (
      <WikiCard>
        <p className="text-white/60 text-sm">Loading title...</p>
      </WikiCard>
    );
  }

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
            readOnly={mode === 'view'}
            className="w-full px-0 py-2 text-base font-medium text-white placeholder-white/30 outline-none bg-transparent read-only:cursor-default"
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

      {/* Smart title suggestions — only visible in edit mode */}
      {mode === 'edit' ? (
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

          {!loading && !error && suggestions && suggestions.suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {suggestions.suggestions.map((suggestion) => (
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
              ))}
            </div>
          ) : null}
        </WikiCard>
      </div>
      ) : null}

      {/* People hints — only visible in edit mode */}
      {mode === 'edit' && detail?.tags && detail.tags.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--text-secondary)' }}>
              <Users size={17} />
            </span>
            <h3 className="text-white font-medium text-base">People</h3>
          </div>
          <WikiCard>
            <p className="text-white/40 text-xs mb-2">Check names to prefer in title suggestions.</p>
            <div className="flex flex-col gap-2">
              {detail.tags.length > 1 ? (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detail.tags.every((tag) => preferredPeopleIds.has(tag.id))}
                    onChange={(e) => {
                      if (!detail.tags) return;
                      setPreferredPeopleIds(
                        e.target.checked
                          ? new Set(detail.tags.map((tag) => tag.id))
                          : new Set()
                      );
                    }}
                    className="accent-orange-500 w-4 h-4 shrink-0"
                  />
                  <span className="text-white/60 text-sm">Select all</span>
                </label>
              ) : null}
              {detail.tags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-3 cursor-pointer">
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
          </WikiCard>
        </div>
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => void handleRegenIdeas()}
          disabled={mode === 'view' || refreshing || loading}
          className="flex-1 rounded-full px-5 text-white text-sm font-medium btn-secondary disabled:opacity-60 cursor-pointer"
          style={{ border: '1.5px solid var(--border-btn)', minHeight: 44 }}
        >
          {refreshing ? 'Regenerating...' : 'Regen Ideas'}
        </button>
        {mode === 'view' ? (
          <button
            type="button"
            onClick={() => setMode('edit')}
            className="flex-1 rounded-full px-5 text-white text-sm font-medium"
            style={{ background: '#f97316', border: 'none', minHeight: 44, cursor: 'pointer' }}
          >
            Edit
          </button>
        ) : (
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
        )}
      </div>
    </>
  );
}
