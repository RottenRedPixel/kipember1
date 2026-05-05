'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type Step = {
  slug: string;
  label: string;
  enabled: boolean;
  position: number;
  ownerRequired: boolean;
  contributorMin: number | null;
  updatedAt: string;
};

type ApiResponse = {
  steps: Step[];
};

// Plain-English description per step. Helps admins understand what a
// step actually requires without having to read the wiki source.
const STEP_DESCRIPTIONS: Record<string, string> = {
  contributors: 'At least one contributor has been added to the ember.',
  people: 'Every person detected in the photo has been tagged.',
  title: 'A title (manual or AI-suggested) is saved on the ember.',
  snapshot: 'The snapshot script — the spoken summary — has been generated.',
  'time-place': 'Both the date and the location of the memory are filled in.',
  photos: 'A cover photo is set (true as soon as an ember is created).',
  'image-analysis': 'The AI has finished analyzing the cover photo.',
  'story-circle': 'A back-and-forth conversation about the memory.',
  why: 'The reason behind the memory has been captured.',
  'emotional-states': 'How people felt during the memory has been captured.',
};

// Steps where contributor engagement is part of the completion rule.
// Only these surface the owner / contributor-min / all-invited controls;
// the rest are owner-action steps where those settings don't apply.
const MULTI_PARTY_SLUGS = new Set(['story-circle', 'why', 'emotional-states']);

export default function AdminProgressTrackerPage() {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/system/progress-tracker', { cache: 'no-store' });
      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        return;
      }
      const payload = (await res.json()) as ApiResponse;
      setSteps(payload.steps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchStep = useCallback(
    async (
      slug: string,
      patch: { enabled?: boolean; ownerRequired?: boolean; contributorMin?: number | null }
    ) => {
      setPendingSlug(slug);
      try {
        const res = await fetch('/api/admin/system/progress-tracker', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, ...patch }),
        });
        if (!res.ok) {
          setError(`Update failed (${res.status})`);
          return;
        }
        setSteps((prev) =>
          prev ? prev.map((s) => (s.slug === slug ? { ...s, ...patch } : s)) : prev
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
      } finally {
        setPendingSlug(null);
      }
    },
    []
  );

  const enabledCount = steps ? steps.filter((s) => s.enabled).length : 0;
  const totalCount = steps?.length ?? 0;

  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-xl lg:text-2xl font-semibold">Progress Tracker</h1>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-1">
        Each step represents one of the milestones the wiki progress bar
        watches. Disable a step to drop it from the bar entirely. For
        multi-party steps, set whether the owner must contribute and how
        many invited contributors must participate. Currently {enabledCount}{' '}
        of {totalCount} active.
      </p>
      <p className="text-xs text-gray-500 mb-5">
        <strong className="text-gray-700">All invited</strong> means every
        contributor invited to the ember must contribute before this step
        counts complete — if 3 contributors are invited, all 3 must add
        something. With it off, the number you set is a fixed minimum
        (e.g. 1 = at least one contributor, regardless of how many are
        invited).
      </p>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {(steps ?? []).map((step, idx) => {
          const isPending = pendingSlug === step.slug;
          const isMultiParty = MULTI_PARTY_SLUGS.has(step.slug);
          const isAll = step.contributorMin === null;
          return (
            <div
              key={step.slug}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* Header row — number, label, enabled toggle */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <span className="text-gray-400 font-mono text-xs w-5 text-right">
                  {idx + 1}
                </span>
                <h2 className="flex-1 font-semibold text-gray-900 text-sm">
                  {step.label}
                </h2>
                <span className="text-xs text-gray-500">
                  {step.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={step.enabled}
                  disabled={isPending}
                  onClick={() => void patchStep(step.slug, { enabled: !step.enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                    step.enabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      step.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Body — description + step-specific controls */}
              <div className="px-4 py-3 flex flex-col gap-3">
                <p className="text-sm text-gray-600 leading-relaxed">
                  {STEP_DESCRIPTIONS[step.slug] ?? '—'}
                </p>

                {isMultiParty ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-col gap-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                      Completion rule
                    </p>

                    {/* Owner row */}
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <span className="text-sm text-gray-700">
                        Owner must contribute
                      </span>
                      <input
                        type="checkbox"
                        checked={step.ownerRequired}
                        disabled={isPending}
                        onChange={(e) =>
                          void patchStep(step.slug, { ownerRequired: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </label>

                    {/* Contributor row */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-sm text-gray-700">
                        Contributors needed
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          aria-label={`Minimum contributors for ${step.label}`}
                          value={isAll ? '' : step.contributorMin ?? 0}
                          disabled={isPending || isAll}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const parsed = raw === '' ? 0 : Math.max(0, Math.floor(Number(raw)));
                            if (Number.isFinite(parsed)) {
                              void patchStep(step.slug, { contributorMin: parsed });
                            }
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:text-gray-400"
                        />
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isAll}
                            disabled={isPending}
                            onChange={(e) =>
                              void patchStep(step.slug, {
                                contributorMin: e.target.checked ? null : 1,
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">All invited</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    Owner-only step — no contributor controls apply.
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {steps && steps.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-6 text-center text-gray-500">
            No tracker steps configured.
          </div>
        ) : null}
      </div>
    </div>
  );
}
