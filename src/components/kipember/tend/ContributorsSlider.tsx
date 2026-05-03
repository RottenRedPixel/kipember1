'use client';

import { ChevronRight, MessageSquarePlus, Settings, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import ContributorsListView from '@/components/kipember/ContributorsListView';
import type { KipemberContributor } from '@/components/kipember/KipemberWikiContent';
import type { UnifiedContributor } from '@/lib/contributors-pool';
import { getUserDisplayName } from '@/lib/user-name';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type ContributorVoiceCall = {
  id: string;
  status?: string | null;
  startedAt: string | null;
  endedAt?: string | null;
  createdAt: string;
  callSummary: string | null;
  callTitle?: string | null;
  duration?: number | null;
  recordingUrl?: string | null;
  initiatedBy?: string | null;
};

type ConversationMessage = {
  id: string;
  role?: string | null;
  content: string;
  createdAt: string;
  source?: string | null;
};

type ConversationResponse = {
  id: string;
  questionType?: string | null;
  question?: string | null;
  answer: string;
  source?: string | null;
  createdAt: string;
};

export type TendContributor = KipemberContributor & {
  token: string;
  inviteSent: boolean;
  voiceCalls: ContributorVoiceCall[];
  conversation: {
    status?: string | null;
    currentStep?: string | null;
    messages: ConversationMessage[];
    responses?: ConversationResponse[];
  } | null;
};

export type ContributorDetail = {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  inviteSent: boolean;
  createdAt: string;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phoneNumber: string | null;
  } | null;
  conversation: {
    status: string | null;
    currentStep: string | null;
    responses: ConversationResponse[];
  } | null;
  voiceCalls: ContributorVoiceCall[];
};

type ContributorRecord = KipemberContributor | TendContributor | ContributorDetail;

type ContributorContribution = {
  id: string;
  label: string;
  timestamp: string;
  preview: string;
  sortAt: number;
};

type ContributorsDetail = {
  canManage?: boolean;
  contributors?: TendContributor[];
};

// ────────────────────────────────────────────────────────────
// Helpers (moved from TendActionScreen)
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

function formatContributionDate(value: string | null | undefined) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getContributorPreference(phoneNumber: string | null, email: string | null) {
  if (phoneNumber) return 'SMS';
  if (email) return 'Email';
  return 'Private Link';
}

function buildContributorContributions(
  contributor: ContributorDetail | null,
  fallbackContributor: TendContributor | null
): ContributorContribution[] {
  if (!contributor && !fallbackContributor) return [];

  const voiceCallEntries: ContributorContribution[] = (contributor?.voiceCalls || []).map(
    (voiceCall) => {
      const preview = voiceCall.callSummary?.trim() || 'Transcript preview is not available yet.';
      const atValue = voiceCall.startedAt || voiceCall.createdAt;
      return {
        id: `voice-call-${voiceCall.id}`,
        label: 'Phone Call',
        timestamp: formatContributionDate(atValue),
        preview,
        sortAt: new Date(atValue).getTime() || 0,
      };
    }
  );

  const responseEntries: ContributorContribution[] = (
    contributor?.conversation?.responses || []
  ).map((response) => {
    const question = response.question?.trim();
    const answer = response.answer?.trim();
    const preview = question ? `${question} ${answer}`.trim() : answer || 'Saved response';
    return {
      id: `response-${response.id}`,
      label: 'Saved Response',
      timestamp: formatContributionDate(response.createdAt),
      preview,
      sortAt: new Date(response.createdAt).getTime() || 0,
    };
  });

  const hasDetailContent = voiceCallEntries.length > 0 || responseEntries.length > 0;

  const fallbackEntries: ContributorContribution[] = hasDetailContent
    ? []
    : [
        ...(fallbackContributor?.conversation?.responses || []).map((response) => {
          const question = response.question?.trim();
          const answer = response.answer?.trim();
          const preview = question ? `${question} ${answer}`.trim() : answer || 'Saved response';
          return {
            id: `fallback-response-${response.id}`,
            label: 'Saved Response',
            timestamp: formatContributionDate(response.createdAt),
            preview,
            sortAt: new Date(response.createdAt).getTime() || 0,
          };
        }),
        ...(fallbackContributor?.conversation?.messages || []).map((message) => ({
          id: `message-${message.id}`,
          label: 'Story Message',
          timestamp: formatContributionDate(message.createdAt),
          preview: message.content.trim() || 'Saved story message',
          sortAt: new Date(message.createdAt).getTime() || 0,
        })),
      ];

  return [...voiceCallEntries, ...responseEntries, ...fallbackEntries].sort(
    (left, right) => right.sortAt - left.sortAt
  );
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export type ContributorSubSection = 'profile' | 'contributions' | 'preferences' | null;

const fieldStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
};

export default function ContributorsSlider({
  detail,
  imageId,
  view,
  fromParam,
  contributorFilter,
  subSection,
  onSubSectionChange,
  selectedContributorDetail,
  detailLoading,
  detailError,
  setDetailError,
  refreshContributorDetail,
  refreshDetail,
  onStatus,
  status,
}: {
  detail: ContributorsDetail | null;
  imageId: string | null;
  view: string | null;
  fromParam: string | null;
  contributorFilter: 'ember' | 'all';
  subSection: ContributorSubSection;
  onSubSectionChange: (next: ContributorSubSection) => void;
  selectedContributorDetail: ContributorDetail | null;
  detailLoading: boolean;
  detailError: string;
  setDetailError: (error: string) => void;
  refreshContributorDetail: (id: string) => Promise<unknown>;
  refreshDetail: () => Promise<unknown>;
  onStatus?: (message: string) => void;
  status?: string;
}) {
  const [contributorPool, setContributorPool] = useState<UnifiedContributor[] | null>(null);
  const [sendingContributorId, setSendingContributorId] = useState('');
  const [callingContributorId, setCallingContributorId] = useState('');
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [savedForm, setSavedForm] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [savingContributor, setSavingContributor] = useState(false);

  const filterSuffix = contributorFilter === 'all' ? '&filter=all' : '';
  const fromSuffix = fromParam ? `&from=${fromParam}` : '';
  const listHref = imageId ? `/tend/contributors?id=${imageId}${filterSuffix}` : '/tend/contributors';

  const contributors = detail?.contributors || [];
  const contributor = contributors.find((item) => item.id === view) || null;
  const contributorSource = selectedContributorDetail || contributor;
  const contributorName = contributorDisplayName(contributorSource);
  const contributorPhoneNumber = contributorPhone(contributorSource);
  const contributorEmailAddress = contributorEmail(contributorSource);
  const contributorPreference = getContributorPreference(
    contributorPhoneNumber,
    contributorEmailAddress
  );
  const contributionEntries = buildContributorContributions(
    selectedContributorDetail,
    contributor
  );
  const contributorAvatarFilename = contributor?.user?.avatarFilename || null;
  const contributorCreatedAt = contributorSource?.createdAt || null;
  const canManageContributors = Boolean(detail?.canManage);

  const contributorSections: {
    key: 'profile' | 'contributions' | 'preferences';
    icon: React.ReactNode;
    label: string;
  }[] = [
    { key: 'profile', icon: <User size={20} strokeWidth={1.6} />, label: 'Profile' },
    {
      key: 'contributions',
      icon: <MessageSquarePlus size={20} strokeWidth={1.6} />,
      label: 'Contributions',
    },
    { key: 'preferences', icon: <Settings size={20} strokeWidth={1.6} />, label: 'Preferences' },
  ];

  // Pre-populate edit form when contributor detail loads (and reset sub-section).
  useEffect(() => {
    if (!contributorSource) return;
    const nameParts = contributorDisplayName(contributorSource).trim().split(/\s+/);
    const next = {
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      phone: contributorPhone(contributorSource) ?? '',
      email: contributorEmail(contributorSource) ?? '',
    };
    setAddForm(next);
    setSavedForm(next);
    onSubSectionChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contributorSource?.id]);

  // Load the unified contributor pool for the list view.
  useEffect(() => {
    if (view) return;
    let cancelled = false;
    async function loadPool() {
      try {
        // Pass the current ember so the helper marks each pool entry's
        // onThisEmber + currentEmberContributorId. The "This Ember" filter
        // in the list view filters by that flag — we WANT people already on
        // this ember to appear under "This Ember".
        const qs = imageId ? `?emberId=${imageId}` : '';
        const res = await fetch(`/api/contributors/pool${qs}`, { cache: 'no-store' });
        if (!res.ok) return;
        const payload = (await res.json()) as { contributors?: UnifiedContributor[] };
        if (!cancelled && payload?.contributors) setContributorPool(payload.contributors);
      } catch {
        /* leave pool empty */
      }
    }
    void loadPool();
    return () => {
      cancelled = true;
    };
  }, [view, imageId]);

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
    await refreshDetail();
  }

  async function updateContributor() {
    if (!view) return;
    setSavingContributor(true);
    const response = await fetch(`/api/contributors/${view}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${addForm.firstName} ${addForm.lastName}`.trim(),
        phoneNumber: addForm.phone,
        email: addForm.email,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setSavingContributor(false);
    if (!response.ok) {
      onStatus?.(payload?.error || 'Failed to update contributor.');
      return;
    }
    setSavedForm(addForm);
    onStatus?.('Saved.');
    await refreshDetail();
  }

  async function copyLink(token: string | null | undefined) {
    if (!token) {
      onStatus?.('No contributor link is available.');
      return;
    }
    try {
      const url = `${window.location.origin}/contribute/${token}`;
      await navigator.clipboard.writeText(url);
      onStatus?.('Contributor link copied.');
    } catch (error) {
      onStatus?.(
        error instanceof Error ? error.message : 'Failed to copy contributor link.'
      );
    }
  }

  async function handleSendInvite(contributorId: string) {
    setSendingContributorId(contributorId);
    setDetailError('');
    try {
      const response = await fetch('/api/twilio/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onStatus?.(payload?.error || 'Failed to send the text invite.');
        return;
      }
      onStatus?.('Text invite sent.');
      await refreshDetail();
      if (view === contributorId) {
        await refreshContributorDetail(contributorId);
      }
    } catch (error) {
      onStatus?.(
        error instanceof Error ? error.message : 'Failed to send the text invite.'
      );
    } finally {
      setSendingContributorId('');
    }
  }

  async function handleStartVoiceCall(contributorId: string) {
    setCallingContributorId(contributorId);
    setDetailError('');
    try {
      const response = await fetch('/api/voice/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onStatus?.(payload?.error || 'Failed to start the phone call.');
        return;
      }
      onStatus?.('Phone call started.');
      await refreshDetail();
      if (view === contributorId) {
        await refreshContributorDetail(contributorId);
      }
    } catch (error) {
      onStatus?.(
        error instanceof Error ? error.message : 'Failed to start the phone call.'
      );
    } finally {
      setCallingContributorId('');
    }
  }

  // ────────────────────────────────────────────────────────
  // List view
  // ────────────────────────────────────────────────────────
  if (!view) {
    if (!imageId) return null;
    const baseHref = `/tend/contributors?id=${imageId}`;
    const filtered = (contributorPool ?? []).filter((c) =>
      contributorFilter === 'ember' ? c.onThisEmber : true
    );
    return (
      <ContributorsListView
        contributors={filtered}
        context={{
          kind: 'ember',
          emberId: imageId,
          canManage: canManageContributors,
          addNewHref: `${baseHref}${filterSuffix}&view=add${fromSuffix}`,
          rowDetailHref: ({ contributorIdOnThisEmber }) =>
            `${baseHref}${filterSuffix}&view=${contributorIdOnThisEmber}${fromSuffix}`,
          filter: contributorFilter,
          filterHrefs: {
            ember: `${baseHref}${fromSuffix}`,
            all: `${baseHref}&filter=all${fromSuffix}`,
          },
        }}
      />
    );
  }

  // ────────────────────────────────────────────────────────
  // Add view
  // ────────────────────────────────────────────────────────
  if (view === 'add') {
    return (
      <>
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
        <div className="py-2 flex gap-3">
          <Link
            href={listHref}
            className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium btn-secondary"
            style={{
              background: 'transparent',
              border: '1.5px solid var(--border-btn)',
              minHeight: 44,
            }}
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={() => void addContributor()}
            className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium can-hover-dim btn-primary"
            style={{ background: '#f97316', minHeight: 44 }}
          >
            Save
          </button>
        </div>
      </>
    );
  }

  // ────────────────────────────────────────────────────────
  // Detail view (a specific contributor)
  // ────────────────────────────────────────────────────────
  if (!contributorSource) return null;

  return (
    <>
      {/* Main view */}
      {!subSection ? (
        <div className="flex flex-col items-center gap-6 py-2">
          {/* Avatar + name + Member since */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="rounded-full overflow-hidden flex items-center justify-center"
              style={{ width: 80, height: 80, background: 'rgba(249,115,22,0.85)' }}
            >
              {contributorAvatarFilename ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/uploads/${contributorAvatarFilename}`}
                  alt={contributorName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-2xl font-medium">
                  {initials(contributorName)}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-white font-semibold text-base">{contributorName}</span>
              {contributorCreatedAt ? (
                <span className="text-white/30 text-xs mt-1">
                  Member since{' '}
                  {new Date(contributorCreatedAt).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              ) : null}
            </div>
          </div>

          {/* Menu */}
          <div
            className="w-full rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            {contributorSections.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onSubSectionChange(s.key)}
                className="w-full flex items-center gap-3 px-4"
                style={{
                  minHeight: 52,
                  cursor: 'pointer',
                  borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined,
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>{s.icon}</span>
                <span className="flex-1 text-left text-sm text-white">{s.label}</span>
                <ChevronRight size={16} color="var(--text-secondary)" strokeWidth={1.8} />
              </button>
            ))}
          </div>

          {/* Call Now / Send Text Now */}
          <div className="w-full flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (contributor && contributorPhoneNumber) {
                  void handleStartVoiceCall(contributor.id);
                } else if (contributor?.token) {
                  void copyLink(contributor.token);
                }
              }}
              disabled={
                !canManageContributors ||
                (!contributorPhoneNumber && !contributor?.token) ||
                callingContributorId === contributor?.id
              }
              className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium btn-secondary disabled:opacity-40"
              style={{
                background: 'transparent',
                border: '1.5px solid var(--border-btn)',
                minHeight: 44,
              }}
            >
              {contributorPhoneNumber ? 'Call Now' : 'Copy Link'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (contributor && contributorPhoneNumber) {
                  void handleSendInvite(contributor.id);
                } else if (contributor?.token) {
                  void copyLink(contributor.token);
                }
              }}
              disabled={
                !canManageContributors ||
                (!contributorPhoneNumber && !contributor?.token) ||
                sendingContributorId === contributor?.id
              }
              className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium can-hover-dim btn-primary disabled:opacity-40"
              style={{ background: '#f97316', minHeight: 44 }}
            >
              Send Text Now
            </button>
          </div>
        </div>
      ) : null}

      {/* Profile sub-section */}
      {subSection === 'profile' ? (
        <>
          <div
            className="rounded-xl px-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <input
              type="text"
              value={addForm.firstName}
              onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
              placeholder="First name"
              className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
            />
            <input
              type="text"
              value={addForm.lastName}
              onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))}
              placeholder="Last name"
              className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            />
            <input
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Email"
              className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            />
            <input
              type="tel"
              value={addForm.phone}
              onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Phone"
              className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            />
          </div>
          {(() => {
            const isDirty =
              addForm.firstName !== savedForm.firstName ||
              addForm.lastName !== savedForm.lastName ||
              addForm.phone !== savedForm.phone ||
              addForm.email !== savedForm.email;
            return (
              <div className="flex justify-between items-center px-1">
                {status ? (
                  <span className="text-xs text-white/50">{status}</span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => void updateContributor()}
                  disabled={savingContributor || !isDirty}
                  className="w-1/2 rounded-full px-5 text-white text-sm font-medium transition-colors"
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
            );
          })()}
        </>
      ) : null}

      {/* Contributions sub-section */}
      {subSection === 'contributions' ? (
        <div>
          {detailLoading ? (
            <div
              className="rounded-xl px-4 py-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <p className="text-white/30 text-xs italic">Loading contributor details...</p>
            </div>
          ) : null}

          {detailError ? (
            <div
              className="rounded-xl px-4 py-3 mb-4"
              style={{
                background: 'rgba(94,20,20,0.48)',
                border: '1px solid rgba(255,119,119,0.35)',
              }}
            >
              <p className="text-[rgba(255,210,210,0.94)] text-sm">{detailError}</p>
            </div>
          ) : null}

          {!detailLoading && !detailError && contributionEntries.length === 0 ? (
            <p className="text-white/30 text-sm">No contributions yet.</p>
          ) : null}

          {!detailLoading && !detailError
            ? contributionEntries.map((entry) => (
                <div key={entry.id} className="mb-4">
                  <p className="text-white/60 text-xs font-medium mb-1">
                    {entry.label} ·{' '}
                    <span className="text-white/30">{entry.timestamp}</span>
                  </p>
                  <div
                    className="rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <p className="text-white/45 text-xs leading-relaxed">{entry.preview}</p>
                  </div>
                </div>
              ))
            : null}
        </div>
      ) : null}

      {/* Preferences sub-section */}
      {subSection === 'preferences' ? (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div
            className="flex items-center justify-between px-4"
            style={{ minHeight: 44 }}
          >
            <span className="text-white text-sm font-medium">
              Prefers{' '}
              <span className="text-white/50 font-normal">({contributorPreference})</span>
            </span>
          </div>
          <div
            className="flex items-center justify-between px-4"
            style={{ minHeight: 44, borderTop: '1px solid var(--border-subtle)' }}
          >
            <span className="text-white text-sm font-medium">
              Contact Time <span className="text-white/50 font-normal">(Not set)</span>
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
        </div>
      ) : null}
    </>
  );
}

// Re-export the formatPhoneNumber helper for places outside this slider that
// might want it. Currently only used internally; safe to keep co-located.
export { formatPhoneNumber };
