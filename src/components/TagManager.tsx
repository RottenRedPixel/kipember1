'use client';

import { useMemo, useState } from 'react';

type Tag = {
  id: string;
  label: string;
  userId: string | null;
  contributorId: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  contributor?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

type PersonOption = {
  id: string;
  label: string;
  source: 'friend' | 'contributor';
};

export default function TagManager({
  imageId,
  tags,
  contributors,
  friends,
  canManage,
  onUpdate,
}: {
  imageId: string;
  tags: Tag[];
  contributors: Array<{ id: string; name: string | null; email: string | null; userId: string | null }>;
  friends: Array<{ id: string; name: string | null; email: string }>;
  canManage: boolean;
  onUpdate: () => void;
}) {
  const [manualLabel, setManualLabel] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const quickOptions = useMemo<PersonOption[]>(() => {
    const existingLabels = new Set(tags.map((tag) => tag.label.toLowerCase()));

    return [
      ...contributors
        .map((contributor) => ({
          id: contributor.id,
          label: contributor.name || contributor.email || 'Unnamed contributor',
          source: 'contributor' as const,
        }))
        .filter((option) => !existingLabels.has(option.label.toLowerCase())),
      ...friends
        .map((friend) => ({
          id: friend.id,
          label: friend.name || friend.email,
          source: 'friend' as const,
        }))
        .filter((option) => !existingLabels.has(option.label.toLowerCase())),
    ];
  }, [contributors, friends, tags]);

  const createTag = async (body: Record<string, string>) => {
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/images/${imageId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create tag');
      }

      setManualLabel('');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    } finally {
      setSubmitting(false);
    }
  };

  const removeTag = async (tagId: string) => {
    setError('');

    try {
      const response = await fetch(`/api/images/${imageId}/tags/${tagId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Failed to remove tag');
      }

      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove tag');
    }
  };

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-950">People in this Ember</h2>
        <p className="mt-2 text-sm text-slate-600">
          Tag the people connected to this moment so they are easy to recognize across the story.
        </p>
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-slate-500">No one has been tagged yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
            >
              {tag.label}
              {canManage && (
                <button
                  type="button"
                  onClick={() => removeTag(tag.id)}
                  className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 transition hover:text-amber-900"
                >
                  Remove
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {canManage && (
        <>
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Quick tag
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickOptions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Add contributors or friends to unlock quick-tag suggestions.
                </p>
              ) : (
                quickOptions.slice(0, 10).map((option) => (
                  <button
                    key={`${option.source}-${option.id}`}
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      createTag(
                        option.source === 'friend'
                          ? { userId: option.id }
                          : { contributorId: option.id }
                      )
                    }
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950 disabled:opacity-60"
                  >
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!manualLabel.trim()) {
                return;
              }
              void createTag({ label: manualLabel.trim() });
            }}
            className="mt-6 flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="text"
              value={manualLabel}
              onChange={(event) => setManualLabel(event.target.value)}
              placeholder="Add a custom tag"
              className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
            />
            <button
              type="submit"
              disabled={submitting || !manualLabel.trim()}
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Adding...' : 'Add tag'}
            </button>
          </form>
        </>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}
