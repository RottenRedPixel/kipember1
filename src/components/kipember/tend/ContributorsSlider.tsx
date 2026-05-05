'use client';

import { ChevronDown, Plus } from 'lucide-react';
import { useState } from 'react';
import type { KipemberContributor } from '@/components/kipember/KipemberWikiContent';
import { pastelForContributorIdentity } from '@/lib/contributor-color';
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

function getContributorPreference(phoneNumber: string | null, email: string | null) {
  if (phoneNumber) return 'SMS';
  if (email) return 'Email';
  return 'Private Link';
}

const fieldStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
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
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [savedForm, setSavedForm] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [savingContributor, setSavingContributor] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', phone: '', email: '' });

  const contributors = detail?.contributors || [];
  const canManageContributors = Boolean(detail?.canManage);

  function expandRow(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    const c = contributors.find((x) => x.id === id);
    if (c) {
      const nameParts = contributorDisplayName(c).trim().split(/\s+/);
      const next = {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        phone: contributorPhone(c) ?? '',
        email: contributorEmail(c) ?? '',
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
    setAddForm({ firstName: '', lastName: '', phone: '', email: '' });
    setAdding(false);
    await refreshDetail();
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
    await refreshDetail();
  }

  return (
    <div className="flex flex-col gap-3">
      {contributors.length === 0 ? (
        <div
          className="rounded-xl px-4 py-3"
          style={{
            background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <p className="text-white/30 text-sm">No contributors yet.</p>
        </div>
      ) : null}

      {contributors.map((contributor) => {
        const isExpanded = expandedId === contributor.id;
        const name = contributorDisplayName(contributor);
        const phone = contributorPhone(contributor);
        const email = contributorEmail(contributor);
        const preference = getContributorPreference(phone, email);
        const phoneFormatted = formatPhoneNumber(phone);
        const inviteStatus = contributor.inviteSent ? 'Invited' : 'Not Invited';
        const avatarFilename = contributor.user?.avatarFilename || null;
        const isDirty =
          isExpanded &&
          (editForm.firstName !== savedForm.firstName ||
            editForm.lastName !== savedForm.lastName ||
            editForm.phone !== savedForm.phone ||
            editForm.email !== savedForm.email);
        return (
          <div
            key={contributor.id}
            className="rounded-xl overflow-hidden"
            style={{
              background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => expandRow(contributor.id)}
              aria-expanded={isExpanded}
              className="w-full flex items-center gap-3 px-4 cursor-pointer"
              style={{ minHeight: 56 }}
            >
              <div
                className="rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  background: avatarFilename
                    ? 'rgba(249,115,22,0.85)'
                    : pastelForContributorIdentity({
                        userId: contributor.user?.id ?? contributor.userId ?? null,
                        email: contributor.email ?? null,
                        phoneNumber: contributor.phoneNumber ?? null,
                        id: contributor.id,
                      }),
                }}
              >
                {avatarFilename ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/uploads/${avatarFilename}`}
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
              <ChevronDown
                size={14}
                color="rgba(255,255,255,0.5)"
                style={{
                  transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 0.15s ease',
                }}
              />
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
                  </div>
                  <div className="flex justify-between items-center px-1">
                    {status ? (
                      <span className="text-xs text-white/50">{status}</span>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      onClick={() => void updateContributor(contributor.id)}
                      disabled={savingContributor || !isDirty || !canManageContributors}
                      className="rounded-full px-5 text-white text-sm font-medium transition-colors"
                      style={{
                        background: isDirty ? '#f97316' : 'var(--bg-surface)',
                        border: isDirty ? 'none' : '1px solid var(--border-subtle)',
                        minHeight: 44,
                        cursor: isDirty ? 'pointer' : 'default',
                        opacity: savingContributor ? 0.6 : 1,
                      }}
                    >
                      {savingContributor ? 'Updating…' : 'Update'}
                    </button>
                  </div>
                </div>

                {/* Preferences */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-white/40 text-xs uppercase tracking-wider font-medium">
                    Preferences
                  </h3>
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div
                      className="flex items-center justify-between px-4"
                      style={{ minHeight: 44 }}
                    >
                      <span className="text-white text-sm font-medium">
                        Prefers{' '}
                        <span className="text-white/50 font-normal">({preference})</span>
                      </span>
                    </div>
                    <div
                      className="flex items-center justify-between px-4"
                      style={{ minHeight: 44, borderTop: '1px solid var(--border-subtle)' }}
                    >
                      <span className="text-white text-sm font-medium">
                        Contact Time{' '}
                        <span className="text-white/50 font-normal">(Not set)</span>
                      </span>
                    </div>
                    <div
                      className="flex items-center justify-between px-4"
                      style={{ minHeight: 44, borderTop: '1px solid var(--border-subtle)' }}
                    >
                      <span className="text-white text-sm font-medium">
                        Language <span className="text-white/50 font-normal">(English)</span>
                      </span>
                    </div>
                    {phoneFormatted ? (
                      <div
                        className="flex items-center justify-between px-4"
                        style={{ minHeight: 44, borderTop: '1px solid var(--border-subtle)' }}
                      >
                        <span className="text-white text-sm font-medium">
                          Phone{' '}
                          <span className="text-white/50 font-normal">({phoneFormatted})</span>
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

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
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setAddForm({ firstName: '', lastName: '', phone: '', email: '' });
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
