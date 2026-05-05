'use client';

import { ChevronDown, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KipemberContributor } from '@/components/kipember/KipemberWikiContent';
import { pastelForContributorIdentity } from '@/lib/contributor-color';
import type { UnifiedContributor } from '@/lib/contributors-pool';
import { getUserDisplayName } from '@/lib/user-name';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type TendContributor = KipemberContributor & {
  // Optional because the wiki's KipemberContributor[] doesn't carry
  // these fields — the inline accordion treats them as nice-to-have
  // status (Invited / Not Invited) rather than required data.
  token?: string;
  inviteSent?: boolean;
};

type ContributorRecord = KipemberContributor | TendContributor;

type ContributorsDetail = {
  canManage?: boolean;
  contributors?: TendContributor[];
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function initials(value: string | null | undefined) {
  const label = value?.trim() || 'Contributor';
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function contributorDisplayName(contributor: ContributorRecord | null | undefined) {
  if (!contributor) return 'Contributor';
  return (
    contributor.name ||
    getUserDisplayName(contributor.user) ||
    contributor.email ||
    contributor.user?.email ||
    contributor.phoneNumber ||
    contributor.user?.phoneNumber ||
    'Contributor'
  );
}

function contributorEmail(contributor: ContributorRecord | null | undefined) {
  return contributor?.email || contributor?.user?.email || null;
}

function contributorPhone(contributor: ContributorRecord | null | undefined) {
  return contributor?.phoneNumber || contributor?.user?.phoneNumber || null;
}

function formatPhoneNumber(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}.${normalized.slice(3, 6)}.${normalized.slice(6, 10)}`;
  }
  return value;
}

// Languages offered for the per-contributor preference dropdown. Drives
// both the Add Contributor form and the inline Profile editor. Currently
// UI-only — the contributors API doesn't persist this yet.
const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Chinese',
  'Japanese',
  'Korean',
  'Arabic',
];

// Input fields match the card background — the field outline (border)
// alone provides the affordance, so the input visually sits on the
// same surface as the surrounding card without competing for depth.
const fieldStyle = {
  background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
  border: '1px solid var(--border-subtle)',
};

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

// Single-screen contributors editor: each contributor renders as a
// collapsible row. Tapping expands the row to show Profile +
// Preferences stacked inline (no drill-down navigation, no
// sub-section tabs). Contributions live elsewhere in the wiki
// (Story Circle, Why, Emotional States, etc.) — they're shown in
// context with the memory rather than buried under each contributor.
export default function ContributorsSlider({
  detail,
  imageId,
  refreshDetail,
  onStatus,
  status,
}: {
  detail: ContributorsDetail | null;
  imageId: string | null;
  refreshDetail: () => Promise<unknown>;
  onStatus?: (message: string) => void;
  status?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', email: '', language: 'English' });
  const [savedForm, setSavedForm] = useState({ firstName: '', lastName: '', phone: '', email: '', language: 'English' });
  const [savingContributor, setSavingContributor] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', phone: '', email: '', language: 'English' });
  // Filter pill (This Ember / All) and sort dropdown — restored from the
  // legacy ContributorsListView. Drives which subset of the owner's
  // unified contributor pool we render (and in what order).
  const [filter, setFilter] = useState<'ember' | 'all'>('ember');
  const [sort, setSort] = useState<'Name' | 'Most Embers'>('Name');
  const [sortOpen, setSortOpen] = useState(false);
  const [pool, setPool] = useState<UnifiedContributor[] | null>(null);

  const contributors = detail?.contributors || [];
  const canManageContributors = Boolean(detail?.canManage);

  // Pull the deduped pool of contributors across all the owner's embers
  // — same source the legacy slider's list view used. Refetched whenever
  // the ember changes or the slider mounts; the wiki's refreshDetail
  // would be a useful invalidation hook but the slider closes after
  // adding so a stale list isn't a real concern.
  // Hoisted so addContributor can call it after a successful POST —
  // the new entry needs to land in the unified pool before the list
  // re-renders with it.
  const refreshPool = useCallback(async () => {
    if (!imageId) return;
    try {
      const response = await fetch(`/api/contributors/pool?emberId=${imageId}`, { cache: 'no-store' });
      if (!response.ok) return;
      const payload = (await response.json()) as { contributors?: UnifiedContributor[] };
      if (payload?.contributors) {
        setPool(payload.contributors);
      }
    } catch {
      // Silently fall back to existing pool data — better than flashing an error.
    }
  }, [imageId]);
  useEffect(() => {
    void refreshPool();
  }, [refreshPool]);

  // Quick lookup: pool key → invited flag from detail.contributors. The
  // pool API doesn't carry invite status, but detail.contributors does
  // for anyone on this ember.
  const inviteByEmberContributorId = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const c of contributors) {
      map.set(c.id, Boolean(c.inviteSent));
    }
    return map;
  }, [contributors]);

  function expandRow(emberContributorId: string) {
    if (expandedId === emberContributorId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(emberContributorId);
    const c = contributors.find((x) => x.id === emberContributorId);
    if (c) {
      const nameParts = contributorDisplayName(c).trim().split(/\s+/);
      const next = {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        phone: contributorPhone(c) ?? '',
        email: contributorEmail(c) ?? '',
        // Language isn't persisted yet — defaults to English for now.
        language: 'English',
      };
      setEditForm(next);
      setSavedForm(next);
    }
  }

  async function addContributor() {
    if (!imageId) return;
    const response = await fetch('/api/contributors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageId,
        name: `${addForm.firstName} ${addForm.lastName}`.trim(),
        phoneNumber: addForm.phone,
        email: addForm.email,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      onStatus?.(payload?.error || 'Failed to add contributor.');
      return;
    }
    onStatus?.('Contributor added.');
    setAddForm({ firstName: '', lastName: '', phone: '', email: '', language: 'English' });
    setAdding(false);
    await Promise.all([refreshDetail(), refreshPool()]);
  }

  async function updateContributor(contributorId: string) {
    setSavingContributor(true);
    const response = await fetch(`/api/contributors/${contributorId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${editForm.firstName} ${editForm.lastName}`.trim(),
        phoneNumber: editForm.phone,
        email: editForm.email,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setSavingContributor(false);
    if (!response.ok) {
      onStatus?.(payload?.error || 'Failed to update contributor.');
      return;
    }
    setSavedForm(editForm);
    onStatus?.('Saved.');
    await Promise.all([refreshDetail(), refreshPool()]);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar — filter pill (This Ember / All) + sort dropdown */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-1 rounded-xl p-1"
          style={{ background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)' }}
        >
          <button
            type="button"
            onClick={() => setFilter('ember')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            style={{
              background: filter === 'ember' ? 'var(--bg-screen)' : 'transparent',
              color: filter === 'ember' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
            }}
          >
            This Ember
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            style={{
              background: filter === 'all' ? 'var(--bg-screen)' : 'transparent',
              color: filter === 'all' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
            }}
          >
            All
          </button>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((s) => !s)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl can-hover"
            style={{
              background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            <span className="text-white text-xs font-medium">{sort}</span>
            <ChevronDown size={13} color="rgba(255,255,255,0.5)" strokeWidth={2} />
          </button>
          {sortOpen ? (
            <div
              className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-10"
              style={{
                background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
                border: '1px solid var(--border-subtle)',
                minWidth: 140,
              }}
            >
              {(['Name', 'Most Embers'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setSort(opt);
                    setSortOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-white can-hover"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: sort === opt ? 600 : 400,
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {(() => {
        // Build display list from the unified pool. While the pool is
        // loading, fall back to detail.contributors so the user sees
        // something — that fallback is what was rendered before the
        // filter+sort toolbar existed.
        const source: UnifiedContributor[] | null = pool;
        const filtered = source
          ? filter === 'ember'
            ? source.filter((c) => c.onThisEmber)
            : source
          : null;
        const sorted = filtered
          ? [...filtered].sort((a, b) => {
              if (sort === 'Most Embers') {
                if (b.emberCount !== a.emberCount) return b.emberCount - a.emberCount;
              }
              return a.name.localeCompare(b.name);
            })
          : null;

        if (sorted && sorted.length === 0) {
          return (
            <div
              className="rounded-xl px-4 py-3"
              style={{
                background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <p className="text-white/30 text-sm">
                {filter === 'ember'
                  ? 'No contributors on this ember yet.'
                  : 'No contributors in your pool yet.'}
              </p>
            </div>
          );
        }

        // While the pool is still loading, render nothing (the toolbar
        // is already on screen so the area doesn't look empty).
        if (!sorted) return null;

        return sorted.map((contributor) => {
          const emberContributorId = contributor.currentEmberContributorId;
          const onThisEmber = contributor.onThisEmber;
          const isExpanded = onThisEmber && expandedId === emberContributorId;
          const name = contributor.name;
          const avatarUrl = contributor.avatarUrl;
          const inviteSent = emberContributorId
            ? inviteByEmberContributorId.get(emberContributorId) ?? false
            : false;
          const inviteStatus = onThisEmber
            ? inviteSent
              ? 'Invited'
              : 'Not Invited'
            : `In ${contributor.emberCount} ember${contributor.emberCount === 1 ? '' : 's'}`;
          const isDirty =
            isExpanded &&
            (editForm.firstName !== savedForm.firstName ||
              editForm.lastName !== savedForm.lastName ||
              editForm.phone !== savedForm.phone ||
              editForm.email !== savedForm.email ||
              editForm.language !== savedForm.language);
          // Pool entries that aren't on this ember have no
          // EmberContributor record to PATCH against, so the row is
          // collapse-only — no chevron, no expansion, no editing.
          const expandable = onThisEmber && Boolean(emberContributorId);
        return (
          <div
            key={contributor.key}
            className="rounded-xl overflow-hidden"
            style={{
              background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (expandable && emberContributorId) {
                  expandRow(emberContributorId);
                }
              }}
              aria-expanded={isExpanded}
              disabled={!expandable}
              className="w-full flex items-center gap-3 px-4"
              style={{ minHeight: 56, cursor: expandable ? 'pointer' : 'default' }}
            >
              <div
                className="rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  background: avatarUrl
                    ? 'rgba(249,115,22,0.85)'
                    : pastelForContributorIdentity({
                        userId: null,
                        email: null,
                        phoneNumber: null,
                        id: contributor.key,
                      }),
                }}
              >
                {avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={avatarUrl}
                    alt={name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-medium" style={{ color: '#1f2937' }}>
                    {initials(name)}
                  </span>
                )}
              </div>
              <span className="flex-1 text-white text-sm font-medium text-left">{name}</span>
              <span className="text-white/30 text-xs">{inviteStatus}</span>
              {expandable ? (
                <ChevronDown
                  size={14}
                  color="rgba(255,255,255,0.5)"
                  style={{
                    transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.15s ease',
                  }}
                />
              ) : (
                <span style={{ width: 14, height: 14 }} />
              )}
            </button>

            {isExpanded ? (
              <div
                className="px-4 py-4 flex flex-col gap-4"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                {/* Profile */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-white/40 text-xs uppercase tracking-wider font-medium">
                    Profile
                  </h3>
                  <div
                    className="rounded-xl px-4"
                    style={{
                      background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, firstName: e.target.value }))
                      }
                      placeholder="First name"
                      disabled={!canManageContributors}
                      className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent disabled:opacity-50"
                    />
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, lastName: e.target.value }))
                      }
                      placeholder="Last name"
                      disabled={!canManageContributors}
                      className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent disabled:opacity-50"
                      style={{ borderTop: '1px solid var(--border-subtle)' }}
                    />
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, email: e.target.value }))
                      }
                      placeholder="Email"
                      disabled={!canManageContributors}
                      className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent disabled:opacity-50"
                      style={{ borderTop: '1px solid var(--border-subtle)' }}
                    />
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      placeholder="Phone"
                      disabled={!canManageContributors}
                      className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent disabled:opacity-50"
                      style={{ borderTop: '1px solid var(--border-subtle)' }}
                    />
                    <select
                      value={editForm.language}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, language: e.target.value }))
                      }
                      disabled={!canManageContributors}
                      className="w-full h-12 px-0 text-sm text-white outline-none bg-transparent disabled:opacity-50 cursor-pointer"
                      style={{ borderTop: '1px solid var(--border-subtle)' }}
                    >
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <option key={lang} value={lang} style={{ background: 'var(--bg-screen)', color: 'var(--text-primary)' }}>
                          {lang}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3 items-center">
                    {status ? (
                      <span className="flex-1 text-xs text-white/50">{status}</span>
                    ) : (
                      <div className="flex-1" />
                    )}
                    <button
                      type="button"
                      onClick={() => emberContributorId && void updateContributor(emberContributorId)}
                      disabled={savingContributor || !isDirty || !canManageContributors}
                      className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium can-hover-dim btn-primary disabled:opacity-50 transition-colors"
                      style={{
                        background: isDirty ? '#f97316' : 'var(--bg-surface)',
                        border: isDirty ? 'none' : '1px solid var(--border-subtle)',
                        minHeight: 44,
                        cursor: isDirty && !savingContributor ? 'pointer' : 'default',
                        opacity: savingContributor ? 0.6 : 1,
                      }}
                    >
                      {savingContributor ? 'Updating…' : 'Update'}
                    </button>
                  </div>
                </div>

              </div>
            ) : null}
          </div>
        );
        });
      })()}

      {/* Add Contributor — collapsed button, expands inline into a form */}
      {adding ? (
        <div
          className="rounded-xl px-4 py-4 flex flex-col gap-3"
          style={{
            background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {[
            ['firstName', 'First Name'],
            ['lastName', 'Last Name (optional)'],
            ['phone', 'Phone'],
            ['email', 'Email (optional)'],
          ].map(([key, placeholder]) => (
            <input
              key={key}
              value={addForm[key as keyof typeof addForm]}
              onChange={(event) =>
                setAddForm((current) => ({ ...current, [key]: event.target.value }))
              }
              placeholder={placeholder}
              className="w-full h-12 rounded-xl px-4 text-sm text-white placeholder-white/30 outline-none"
              style={fieldStyle}
            />
          ))}
          <select
            value={addForm.language}
            onChange={(event) =>
              setAddForm((current) => ({ ...current, language: event.target.value }))
            }
            className="w-full h-12 rounded-xl px-4 text-sm text-white outline-none cursor-pointer"
            style={fieldStyle}
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang} value={lang} style={{ background: 'var(--bg-screen)', color: 'var(--text-primary)' }}>
                {lang}
              </option>
            ))}
          </select>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setAddForm({ firstName: '', lastName: '', phone: '', email: '', language: 'English' });
              }}
              className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium btn-secondary"
              style={{
                background: 'transparent',
                border: '1.5px solid var(--border-btn)',
                minHeight: 44,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void addContributor()}
              disabled={!canManageContributors}
              className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium can-hover-dim btn-primary disabled:opacity-50"
              style={{ background: '#f97316', minHeight: 44 }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={!canManageContributors}
          className="rounded-xl flex items-center justify-center gap-2 text-white text-sm font-medium can-hover disabled:opacity-50"
          style={{
            background: 'transparent',
            border: '1px dashed var(--border-subtle)',
            minHeight: 56,
            cursor: 'pointer',
          }}
        >
          <Plus size={16} strokeWidth={1.8} />
          Add Contributor
        </button>
      )}
    </div>
  );
}

// Re-export the formatPhoneNumber helper for places outside this slider.
export { formatPhoneNumber };
