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
  analysis?: {
    noContributors?: boolean | null;
  } | null;
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
    contributor.phoneNumber ||
    contributor.user?.phoneNumber ||
    'Contributor'
  );
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
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', language: 'English' });
  const [savedForm, setSavedForm] = useState({ firstName: '', lastName: '', phone: '', language: 'English' });
  const [savingContributor, setSavingContributor] = useState(false);
  const [callingContributor, setCallingContributor] = useState(false);
  const [callMessage, setCallMessage] = useState<string | null>(null);
  // Mock settings state — not yet wired to API
  const [settingsPreferredComm, setSettingsPreferredComm] = useState('call');
  const [settingsAttempts, setSettingsAttempts] = useState('once');
  const [settingsLangOpen, setSettingsLangOpen] = useState(false);
  const [addLangOpen, setAddLangOpen] = useState(false);
  const [settingsCommOpen, setSettingsCommOpen] = useState(false);
  const [settingsAttemptsOpen, setSettingsAttemptsOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', phone: '', language: 'English' });
  // Filter pill (This Ember / All) and sort dropdown — restored from the
  // legacy ContributorsListView. Drives which subset of the owner's
  // unified contributor pool we render (and in what order).
  const [filter, setFilter] = useState<'ember' | 'all'>('ember');
  const [sort, setSort] = useState<'Name' | 'Most Embers'>('Name');
  const [sortOpen, setSortOpen] = useState(false);
  const [pool, setPool] = useState<UnifiedContributor[] | null>(null);
  const [addingToEmber, setAddingToEmber] = useState<Set<string>>(new Set());
  const [expandedPoolKey, setExpandedPoolKey] = useState<string | null>(null);
  const [noContributors, setNoContributors] = useState(
    Boolean(detail?.analysis?.noContributors)
  );
  const [savingNoContributors, setSavingNoContributors] = useState(false);

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

  useEffect(() => {
    setNoContributors(Boolean(detail?.analysis?.noContributors));
  }, [detail]);

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
    setCallingContributor(false);
    setCallMessage(null);
    const c = contributors.find((x) => x.id === emberContributorId);
    if (c) {
      const nameParts = contributorDisplayName(c).trim().split(/\s+/);
      const next = {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        phone: contributorPhone(c) ?? '',
        // Language isn't persisted yet — defaults to English for now.
        language: 'English',
      };
      setEditForm(next);
      setSavedForm(next);
    }
  }

  async function addExistingToEmber(sourceKey: string) {
    if (!imageId) return;
    setAddingToEmber((prev) => new Set(prev).add(sourceKey));
    try {
      const response = await fetch('/api/contributors/add-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, sourceKey }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        onStatus?.('Contributor added.');
        await Promise.all([refreshDetail(), refreshPool()]);
        setFilter('ember');
      } else {
        onStatus?.(payload?.error || 'Failed to add contributor.');
      }
    } catch {
      onStatus?.('Failed to add contributor.');
    } finally {
      setAddingToEmber((prev) => {
        const next = new Set(prev);
        next.delete(sourceKey);
        return next;
      });
    }
  }

  async function toggleNoContributors(value: boolean) {
    if (!imageId) return;
    setSavingNoContributors(true);
    setNoContributors(value);
    try {
      await fetch(`/api/images/${imageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noContributors: value }),
      });
      await refreshDetail();
    } finally {
      setSavingNoContributors(false);
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
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setAddError(payload?.error || 'Failed to add contributor.');
      return;
    }
    setAddError(null);
    onStatus?.('Contributor added.');
    setAddForm({ firstName: '', lastName: '', phone: '', language: 'English' });
    setAdding(false);
    await Promise.all([refreshDetail(), refreshPool()]);
  }

  async function callContributor(emberContributorId: string) {
    setCallingContributor(true);
    setCallMessage(null);
    try {
      const response = await fetch('/api/voice/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorId: emberContributorId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        setCallMessage('Call started — they should receive it shortly.');
      } else {
        setCallMessage(payload?.error || 'Failed to start call.');
      }
    } catch {
      setCallMessage('Failed to start call.');
    } finally {
      setCallingContributor(false);
    }
  }

  async function updateContributor(contributorId: string) {
    setSavingContributor(true);
    const response = await fetch(`/api/contributors/${contributorId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${editForm.firstName} ${editForm.lastName}`.trim(),
        phoneNumber: editForm.phone,
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
              : 'Part of this ember'
            : `In ${contributor.emberCount} ember${contributor.emberCount === 1 ? '' : 's'}`;
          const isDirty =
            isExpanded &&
            (editForm.firstName !== savedForm.firstName ||
              editForm.lastName !== savedForm.lastName ||
              editForm.phone !== savedForm.phone ||
              editForm.language !== savedForm.language);
          const expandable = onThisEmber && Boolean(emberContributorId);
          const isAdding = addingToEmber.has(contributor.key);
          const canAdd = !onThisEmber && canManageContributors && Boolean(imageId);
          const isPoolExpanded = !onThisEmber && expandedPoolKey === contributor.key;
        return (
          <div
            key={contributor.key}
            className="rounded-xl"
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
              className="w-full flex items-center gap-3 px-4"
              style={{
                minHeight: 56,
                cursor: expandable ? 'pointer' : 'default',
                borderRadius: isExpanded || isPoolExpanded ? '12px 12px 0 0' : '12px',
              }}
            >
              <div
                className="rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  background: avatarUrl
                    ? 'rgba(249,115,22,0.85)'
                    : contributor.avatarColor ?? pastelForContributorIdentity(contributor),
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
                <div
                  className="flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.08)' }}
                >
                  <ChevronDown
                    size={14}
                    color="rgba(255,255,255,0.5)"
                    style={{
                      transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </div>
              ) : canAdd ? (
                <div className="flex items-center gap-1.5">
                  <div
                    className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{
                      width: 28,
                      height: 28,
                      background: isAdding ? 'rgba(249,115,22,0.4)' : '#f97316',
                      cursor: isAdding ? 'default' : 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isAdding) void addExistingToEmber(contributor.key);
                    }}
                  >
                    <Plus size={14} color="white" strokeWidth={2.5} />
                  </div>
                  <div
                    className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{
                      width: 28,
                      height: 28,
                      background: 'rgba(255,255,255,0.08)',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedPoolKey(isPoolExpanded ? null : contributor.key);
                    }}
                  >
                    <ChevronDown
                      size={14}
                      color="rgba(255,255,255,0.5)"
                      style={{
                        transform: isPoolExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <span style={{ width: 14, height: 14 }} />
              )}
            </button>

            {isPoolExpanded ? (() => {
              const nameParts = contributor.name.trim().split(/\s+/);
              const poolFirst = nameParts[0] || '';
              const poolLast = nameParts.slice(1).join(' ') || '';
              return (
                <div
                  className="px-4 py-4 flex flex-col gap-4"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex flex-col gap-2">
                    <h3 className="text-white/40 text-xs uppercase tracking-wider font-medium">Profile</h3>
                    <div
                      className="rounded-xl px-4"
                      style={{ background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)', border: '1px solid var(--border-subtle)' }}
                    >
                      <input readOnly value={poolFirst} placeholder="First name" className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent opacity-70" />
                      <input readOnly value={poolLast} placeholder="Last name" className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent opacity-70" style={{ borderTop: '1px solid var(--border-subtle)' }} />
                      <input readOnly value={formatPhoneNumber(contributor.phoneNumber) ?? ''} placeholder="Phone" className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent opacity-70" style={{ borderTop: '1px solid var(--border-subtle)' }} />
                      <input readOnly value="English" className="w-full h-12 px-0 text-sm text-white outline-none bg-transparent opacity-70" style={{ borderTop: '1px solid var(--border-subtle)' }} />
                    </div>
                  </div>
                </div>
              );
            })() : null}

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
                  </div>
                </div>

                {/* Settings */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-white/40 text-xs uppercase tracking-wider font-medium">Settings</h3>
                  <div
                    className="rounded-xl px-4"
                    style={{
                      background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {/* Preferred Language */}
                    <div className="flex items-center justify-between h-12">
                      <span className="text-sm text-white/70">Language Preference</span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => { setSettingsLangOpen((v) => !v); setSettingsCommOpen(false); setSettingsAttemptsOpen(false); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer"
                          style={{ background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 12%)', border: '1px solid var(--border-subtle)' }}
                        >
                          <span className="text-white text-xs font-medium">{editForm.language}</span>
                          <ChevronDown size={13} color="rgba(255,255,255,0.5)" strokeWidth={2} />
                        </button>
                        {settingsLangOpen ? (
                          <div
                            className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-20"
                            style={{ background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 10%)', border: '1px solid var(--border-subtle)', minWidth: 160 }}
                          >
                            {LANGUAGE_OPTIONS.map((lang) => lang === 'English' ? (
                              <button
                                key={lang}
                                type="button"
                                onClick={() => { setEditForm((f) => ({ ...f, language: lang })); setSettingsLangOpen(false); }}
                                className="w-full text-left px-4 py-2.5 text-xs font-medium cursor-pointer transition-colors"
                                style={{ color: editForm.language === lang ? '#f97316' : 'var(--text-primary)', background: editForm.language === lang ? 'rgba(249,115,22,0.08)' : 'transparent' }}
                              >
                                {lang}
                              </button>
                            ) : (
                              <button key={lang} type="button" disabled className="w-full text-left px-4 py-2.5 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.25)', cursor: 'default' }}>
                                {lang}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Preferred Communication */}
                    <div className="flex items-center justify-between h-12" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <span className="text-sm text-white/70">Communication Preference</span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => { setSettingsCommOpen((v) => !v); setSettingsLangOpen(false); setSettingsAttemptsOpen(false); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer"
                          style={{ background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 12%)', border: '1px solid var(--border-subtle)' }}
                        >
                          <span className="text-white text-xs font-medium">
                            {settingsPreferredComm === 'call' ? 'Phone Call' : settingsPreferredComm === 'sms' ? 'Text Message' : settingsPreferredComm === 'email' ? 'Email' : 'WhatsApp'}
                          </span>
                          <ChevronDown size={13} color="rgba(255,255,255,0.5)" strokeWidth={2} />
                        </button>
                        {settingsCommOpen ? (
                          <div
                            className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-20"
                            style={{ background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 10%)', border: '1px solid var(--border-subtle)', minWidth: 160 }}
                          >
                            <button
                              type="button"
                              onClick={() => { setSettingsPreferredComm('call'); setSettingsCommOpen(false); }}
                              className="w-full text-left px-4 py-2.5 text-xs font-medium cursor-pointer transition-colors"
                              style={{ color: settingsPreferredComm === 'call' ? '#f97316' : 'var(--text-primary)', background: settingsPreferredComm === 'call' ? 'rgba(249,115,22,0.08)' : 'transparent' }}
                            >
                              Phone Call
                            </button>
                            <button type="button" disabled className="w-full text-left px-4 py-2.5 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.25)', cursor: 'default' }}>
                              Text Message
                            </button>
                            <button type="button" disabled className="w-full text-left px-4 py-2.5 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.25)', cursor: 'default' }}>
                              Email
                            </button>
                            <button type="button" disabled className="w-full text-left px-4 py-2.5 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.25)', cursor: 'default' }}>
                              WhatsApp
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Communication Attempts */}
                    <div className="flex items-center justify-between h-12" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <span className="text-sm text-white/70">Communication Attempts</span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => { setSettingsAttemptsOpen((v) => !v); setSettingsLangOpen(false); setSettingsCommOpen(false); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer"
                          style={{ background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 12%)', border: '1px solid var(--border-subtle)' }}
                        >
                          <span className="text-white text-xs font-medium">
                            {settingsAttempts === 'once' ? 'Once' : settingsAttempts === 'twice' ? 'Twice' : settingsAttempts === 'three' ? 'Three Times' : 'Keep Trying'}
                          </span>
                          <ChevronDown size={13} color="rgba(255,255,255,0.5)" strokeWidth={2} />
                        </button>
                        {settingsAttemptsOpen ? (
                          <div
                            className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-20"
                            style={{ background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 10%)', border: '1px solid var(--border-subtle)', minWidth: 200 }}
                          >
                            {([['once', 'Once'], ['twice', 'Twice'], ['three', 'Three Times'], ['forever', 'Keep Trying Until Successful']] as const).map(([val, label]) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => { setSettingsAttempts(val); setSettingsAttemptsOpen(false); }}
                                className="w-full text-left px-4 py-2.5 text-xs font-medium cursor-pointer transition-colors"
                                style={{ color: settingsAttempts === val ? '#f97316' : 'var(--text-primary)', background: settingsAttempts === val ? 'rgba(249,115,22,0.08)' : 'transparent' }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => emberContributorId && void callContributor(emberContributorId)}
                      disabled={callingContributor}
                      className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium cursor-pointer can-hover-dim"
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        minHeight: 44,
                        opacity: callingContributor ? 0.6 : 1,
                        cursor: callingContributor ? 'default' : 'pointer',
                      }}
                    >
                      {callingContributor ? 'Calling…' : 'Call Now'}
                    </button>
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
                      {savingContributor ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                  {(callMessage || status) ? (
                    <p className="text-xs text-white/50 text-center">{callMessage ?? status}</p>
                  ) : null}
                </div>

              </div>
            ) : null}
          </div>
        );
        });
      })()}

      {/* No-contributors toggle */}
      {canManageContributors && (
        <button
          type="button"
          onClick={() => { if (!savingNoContributors) void toggleNoContributors(!noContributors); }}
          className="flex items-center justify-between gap-3 w-full rounded-xl px-4 text-left"
          style={{
            background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
            border: '1px solid var(--border-subtle)',
            minHeight: 56,
            cursor: savingNoContributors ? 'default' : 'pointer',
            opacity: savingNoContributors ? 0.6 : 1,
          }}
        >
          <span className="text-sm text-white/70">I wish to not have contributors in this ember.</span>
          <div
            className="flex-shrink-0 rounded-full transition-colors"
            style={{
              width: 44,
              height: 26,
              background: noContributors ? '#f97316' : 'rgba(255,255,255,0.15)',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 3,
                left: noContributors ? 21 : 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'white',
                transition: 'left 0.15s ease',
              }}
            />
          </div>
        </button>
      )}

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
          ].map(([key, placeholder]) => (
            <input
              key={key}
              value={addForm[key as keyof typeof addForm]}
              onChange={(event) => {
                setAddError(null);
                setAddForm((current) => ({ ...current, [key]: event.target.value }));
              }}
              placeholder={placeholder}
              className="w-full h-12 rounded-xl px-4 text-sm text-white placeholder-white/30 outline-none"
              style={fieldStyle}
            />
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => setAddLangOpen((v) => !v)}
              className="w-full h-12 rounded-xl px-4 flex items-center justify-between cursor-pointer"
              style={fieldStyle}
            >
              <span className="text-sm text-white">{addForm.language}</span>
              <ChevronDown size={15} color="rgba(255,255,255,0.5)" strokeWidth={2} />
            </button>
            {addLangOpen ? (
              <div
                className="absolute left-0 right-0 bottom-full mb-1 rounded-xl overflow-hidden z-20"
                style={{ background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 10%)', border: '1px solid var(--border-subtle)' }}
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => { setAddForm((f) => ({ ...f, language: lang })); setAddLangOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm cursor-pointer transition-colors"
                    style={{ color: addForm.language === lang ? '#f97316' : 'var(--text-primary)', background: addForm.language === lang ? 'rgba(249,115,22,0.08)' : 'transparent' }}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {addError ? (
            <p className="text-xs px-1" style={{ color: '#f87171' }}>{addError}</p>
          ) : null}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setAddError(null);
                setAddForm({ firstName: '', lastName: '', phone: '', language: 'English' });
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
              disabled={!canManageContributors || !addForm.firstName.trim() || !addForm.phone.trim()}
              className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium can-hover-dim btn-primary disabled:opacity-50"
              style={{ background: '#f97316', minHeight: 44 }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={!canManageContributors}
            className="w-1/2 flex items-center justify-center rounded-full text-white text-sm font-medium cursor-pointer disabled:opacity-50"
            style={{ background: '#f97316', minHeight: 44 }}
          >
            Add Contributor
          </button>
        </div>
      )}
    </div>
  );
}

// Re-export the formatPhoneNumber helper for places outside this slider.
export { formatPhoneNumber };
