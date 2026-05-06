'use client';

import { ChevronDown, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { pastelForContributorIdentity } from '@/lib/contributor-color';
import type { UnifiedContributor } from '@/lib/contributors-pool';

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

const fieldStyle = {
  background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
  border: '1px solid var(--border-subtle)',
};

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

export type AccountContributorsAccordionProps = {
  onStatus?: (message: string) => void;
  status?: string;
};

// Account-side counterpart to the wiki's ContributorsSlider. Same accordion
// row design + Add Contributor pattern, but the "This Ember / All" filter is
// replaced with "With Ember / Without Ember" since /account has no ember
// context.
export default function AccountContributorsAccordion({
  onStatus,
  status,
}: AccountContributorsAccordionProps) {
  const [pool, setPool] = useState<UnifiedContributor[] | null>(null);
  const [filter, setFilter] = useState<'with-ember' | 'without-ember'>('with-ember');
  const [sort, setSort] = useState<'Name' | 'Most Embers'>('Name');
  const [sortOpen, setSortOpen] = useState(false);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', email: '', language: 'English' });
  const [savedForm, setSavedForm] = useState({ firstName: '', lastName: '', phone: '', email: '', language: 'English' });
  const [savingContributor, setSavingContributor] = useState(false);

  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', phone: '', email: '', language: 'English' });
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const refreshPool = useCallback(async () => {
    try {
      const r = await fetch('/api/contributors/pool', { cache: 'no-store' });
      if (!r.ok) return;
      const payload = (await r.json()) as { contributors?: UnifiedContributor[] };
      if (payload?.contributors) setPool(payload.contributors);
    } catch {
      // Silent — keep showing previous data.
    }
  }, []);

  useEffect(() => {
    void refreshPool();
  }, [refreshPool]);

  function expandRow(c: UnifiedContributor) {
    if (expandedKey === c.key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(c.key);
    const nameParts = (c.name || '').trim().split(/\s+/);
    const next = {
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      phone: c.phoneNumber || '',
      email: c.email || '',
      language: 'English',
    };
    setEditForm(next);
    setSavedForm(next);
  }

  async function addContributor() {
    if (addBusy) return;
    const name = `${addForm.firstName} ${addForm.lastName}`.trim();
    if (!name && !addForm.phone.trim() && !addForm.email.trim()) {
      setAddError('Add a name, phone, or email.');
      return;
    }
    setAddBusy(true);
    setAddError(null);
    try {
      const res = await fetch('/api/contributors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phoneNumber: addForm.phone, email: addForm.email }),
      });
      const payload = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) {
        setAddError(payload?.error || 'Failed to add contributor.');
        return;
      }
      onStatus?.('Contributor added.');
      setAddForm({ firstName: '', lastName: '', phone: '', email: '', language: 'English' });
      setAdding(false);
      // Newly-added pool entries have emberCount=0, so flip filter so the user
      // can see them right away.
      setFilter('without-ember');
      await refreshPool();
    } catch {
      setAddError('Network error. Try again.');
    } finally {
      setAddBusy(false);
    }
  }

  async function updateContributor(emberContributorId: string) {
    setSavingContributor(true);
    const response = await fetch(`/api/contributors/${emberContributorId}`, {
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
    await refreshPool();
  }

  const sorted = useMemo(() => {
    if (!pool) return null;
    const filtered = filter === 'with-ember'
      ? pool.filter((c) => c.emberCount > 0)
      : pool.filter((c) => c.emberCount === 0);
    return [...filtered].sort((a, b) => {
      if (sort === 'Most Embers') {
        if (b.emberCount !== a.emberCount) return b.emberCount - a.emberCount;
      }
      return a.name.localeCompare(b.name);
    });
  }, [pool, filter, sort]);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar — filter pill (With Ember / Without Ember) + sort dropdown */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-1 rounded-xl p-1"
          style={{ background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)' }}
        >
          <button
            type="button"
            onClick={() => setFilter('with-ember')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            style={{
              background: filter === 'with-ember' ? 'var(--bg-screen)' : 'transparent',
              color: filter === 'with-ember' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
            }}
          >
            With Ember
          </button>
          <button
            type="button"
            onClick={() => setFilter('without-ember')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            style={{
              background: filter === 'without-ember' ? 'var(--bg-screen)' : 'transparent',
              color: filter === 'without-ember' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
            }}
          >
            Without Ember
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

      {sorted === null ? null : sorted.length === 0 ? (
        <div
          className="rounded-xl px-4 py-3"
          style={{
            background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <p className="text-white/30 text-sm">
            {filter === 'with-ember'
              ? 'No contributors on any ember yet.'
              : 'No unattached contributors.'}
          </p>
        </div>
      ) : (
        sorted.map((contributor) => {
          // For account: rows are expandable when the contributor is on at
          // least one ember (we PATCH against the first ember's join row).
          const emberContributorId = contributor.embers[0]?.contributorId ?? null;
          const expandable = Boolean(emberContributorId);
          const isExpanded = expandable && expandedKey === contributor.key;
          const name = contributor.name;
          const avatarUrl = contributor.avatarUrl;
          const subtext =
            contributor.emberCount === 0
              ? 'Not on any ember'
              : contributor.emberCount === 1
                ? 'On 1 ember'
                : `On ${contributor.emberCount} embers`;
          const isDirty =
            isExpanded &&
            (editForm.firstName !== savedForm.firstName ||
              editForm.lastName !== savedForm.lastName ||
              editForm.phone !== savedForm.phone ||
              editForm.email !== savedForm.email ||
              editForm.language !== savedForm.language);
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
                  if (expandable) expandRow(contributor);
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
                      : contributor.avatarColor ?? pastelForContributorIdentity({
                          userId: null,
                          email: null,
                          phoneNumber: null,
                          id: contributor.key,
                        }),
                  }}
                >
                  {avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium" style={{ color: '#1f2937' }}>
                      {initials(name)}
                    </span>
                  )}
                </div>
                <span className="flex-1 text-white text-sm font-medium text-left">{name}</span>
                <span className="text-white/30 text-xs">{subtext}</span>
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
                        onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                        placeholder="First name"
                        className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
                      />
                      <input
                        type="text"
                        value={editForm.lastName}
                        onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                        placeholder="Last name"
                        className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
                        style={{ borderTop: '1px solid var(--border-subtle)' }}
                      />
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="Email"
                        className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
                        style={{ borderTop: '1px solid var(--border-subtle)' }}
                      />
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="Phone"
                        className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
                        style={{ borderTop: '1px solid var(--border-subtle)' }}
                      />
                      <select
                        value={editForm.language}
                        onChange={(e) => setEditForm((f) => ({ ...f, language: e.target.value }))}
                        className="w-full h-12 px-0 text-sm text-white outline-none bg-transparent cursor-pointer"
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
                        disabled={savingContributor || !isDirty}
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
        })
      )}

      {/* Add Contributor — collapsed dashed button, expands inline into a form */}
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
              onChange={(event) => setAddForm((current) => ({ ...current, [key]: event.target.value }))}
              placeholder={placeholder}
              className="w-full h-12 rounded-xl px-4 text-sm text-white placeholder-white/30 outline-none"
              style={fieldStyle}
            />
          ))}
          <select
            value={addForm.language}
            onChange={(event) => setAddForm((current) => ({ ...current, language: event.target.value }))}
            className="w-full h-12 rounded-xl px-4 text-sm text-white outline-none cursor-pointer"
            style={fieldStyle}
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang} value={lang} style={{ background: 'var(--bg-screen)', color: 'var(--text-primary)' }}>
                {lang}
              </option>
            ))}
          </select>
          {addError ? (
            <p className="text-xs px-1" style={{ color: '#f87171' }}>{addError}</p>
          ) : null}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setAddForm({ firstName: '', lastName: '', phone: '', email: '', language: 'English' });
                setAddError(null);
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
              disabled={addBusy}
              className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium can-hover-dim btn-primary disabled:opacity-50"
              style={{ background: '#f97316', minHeight: 44 }}
            >
              {addBusy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-xl flex items-center justify-center gap-2 text-white text-sm font-medium can-hover"
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
