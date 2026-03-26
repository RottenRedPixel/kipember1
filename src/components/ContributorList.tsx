'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

interface Contributor {
  id: string;
  phoneNumber: string | null;
  email: string | null;
  name: string | null;
  userId: string | null;
  token: string;
  inviteSent: boolean;
  conversation: {
    status: string;
    currentStep: string;
  } | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
  } | null;
  voiceCalls: {
    id: string;
    status: string;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
    callSummary: string | null;
    initiatedBy: string;
  }[];
}

interface FriendSuggestion {
  id: string;
  name: string | null;
  email: string;
  phoneNumber: string | null;
}

type ContributorDetail = {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  inviteSent: boolean;
  user: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
  } | null;
  conversation: {
    status: string;
    currentStep: string;
    responses: {
      id: string;
      questionType: string;
      question: string;
      answer: string;
      source: string;
      createdAt: string;
    }[];
  } | null;
  voiceCalls: {
    id: string;
    status: string;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
    callSummary: string | null;
    initiatedBy: string;
  }[];
};

interface ContributorListProps {
  imageId: string;
  ownerUserId: string;
  contributors: Contributor[];
  friends: FriendSuggestion[];
  onUpdate: () => void;
}

function formatQuestionLabel(question: string, questionType: string) {
  if (question.trim()) {
    return question.trim();
  }

  switch (questionType) {
    case 'context':
      return 'Context';
    case 'who':
      return 'Who is in the memory';
    case 'what':
      return 'What happened';
    case 'when':
      return 'When it happened';
    case 'where':
      return 'Where it happened';
    case 'why':
      return 'Why it matters';
    case 'how':
      return 'How it unfolded';
    case 'followup':
      return 'Follow-up';
    default:
      return questionType;
  }
}

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

export default function ContributorList({
  imageId,
  ownerUserId,
  contributors,
  friends,
  onUpdate,
}: ContributorListProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [sendingContributorId, setSendingContributorId] = useState<string | null>(null);
  const [callingContributorId, setCallingContributorId] = useState<string | null>(null);
  const [selectedContributorId, setSelectedContributorId] = useState<string | null>(null);
  const [selectedContributorDetail, setSelectedContributorDetail] = useState<ContributorDetail | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const existingFriendIds = useMemo(
    () => new Set(contributors.map((contributor) => contributor.userId).filter(Boolean)),
    [contributors]
  );

  const suggestedFriends = friends.filter((friend) => !existingFriendIds.has(friend.id));

  const selectedContributor =
    contributors.find((contributor) => contributor.id === selectedContributorId) || null;
  const selectedContributorIsOwner =
    selectedContributor?.userId === ownerUserId;
  const selectedContributorPhone =
    selectedContributor?.phoneNumber || selectedContributor?.user?.phoneNumber || null;

  useEffect(() => {
    if (!selectedContributorId) {
      setSelectedContributorDetail(null);
      setDetailError('');
      return;
    }

    let cancelled = false;

    async function loadContributorDetail() {
      setDetailLoading(true);
      setDetailError('');

      try {
        const response = await fetch(`/api/contributors/${selectedContributorId}/details`, {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load contributor details');
        }

        if (!cancelled) {
          setSelectedContributorDetail(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setDetailError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load contributor details'
          );
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    void loadContributorDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedContributorId, contributors]);

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handleAddContributor = async (body: Record<string, string | null>) => {
    setIsAdding(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/contributors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId,
          ...body,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to add contributor');
      }

      setPhoneNumber('');
      setEmail('');
      setName('');
      setShowAddPanel(false);
      setNotice('Contributor added.');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contributor');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveContributor = async (id: string) => {
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/contributors?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Failed to remove contributor');
      }

      if (selectedContributorId === id) {
        setSelectedContributorId(null);
        setSelectedContributorDetail(null);
      }

      setNotice('Contributor removed.');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove contributor');
    }
  };

  const handleSendInvite = async (contributorId: string) => {
    setSendingContributorId(contributorId);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/twilio/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to send invite');
      }

      setNotice('Text invite sent.');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setSendingContributorId(null);
    }
  };

  const handleStartVoiceCall = async (contributorId: string) => {
    setCallingContributorId(contributorId);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/voice/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to start voice call');
      }

      setNotice('Voice interview started.');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start voice call');
    } finally {
      setCallingContributorId(null);
    }
  };

  const getStatusBadge = (contributor: Contributor) => {
    if (contributor.conversation?.status === 'completed') {
      return <span className="ember-chip text-emerald-700">Completed</span>;
    }

    if (contributor.conversation?.status === 'active') {
      return <span className="ember-chip text-sky-700">In progress</span>;
    }

    if (contributor.inviteSent) {
      return <span className="ember-chip text-[var(--ember-orange-deep)]">Invited</span>;
    }

    return <span className="ember-chip text-[var(--ember-muted)]">Added</span>;
  };

  const getLatestVoiceCall = (contributor: Contributor) => contributor.voiceCalls[0] || null;

  const getVoiceCallLabel = (status: string) => {
    switch (status) {
      case 'registered':
        return 'Voice call starting';
      case 'ongoing':
        return 'Voice call live';
      case 'ended':
        return 'Voice call complete';
      case 'error':
        return 'Voice call failed';
      case 'not_connected':
        return 'Voice call missed';
      default:
        return `Voice: ${status}`;
    }
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/contribute/${token}`;
    await navigator.clipboard.writeText(url);
    setError('');
    setNotice('Contributor link copied.');
  };

  const contributorDetailOverlay =
    selectedContributor && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(17,17,17,0.48)] sm:items-center sm:px-4 sm:py-6"
            onClick={() => setSelectedContributorId(null)}
          >
            <div
              className="ember-panel-strong max-h-[92dvh] w-full overflow-hidden rounded-t-[2rem] sm:max-h-[88vh] sm:max-w-3xl sm:rounded-[2rem]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b ember-divider px-5 py-5 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="ember-eyebrow">Contributor</p>
                    <h3 className="ember-heading mt-3 pr-12 text-2xl text-[var(--ember-text)]">
                      Details and outreach
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedContributorId(null)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ember-line-strong)] bg-white text-[var(--ember-text)] hover:border-[rgba(255,102,33,0.24)]"
                    aria-label="Close contributor details"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(92dvh-6.5rem)] overflow-y-auto px-5 py-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:max-h-[calc(88vh-7rem)] sm:px-6">
                <div className="space-y-5">
                  <div className="ember-card rounded-[1.6rem] px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ember-muted)]">
                      Contact
                    </div>

                    <div className="mt-3 text-xl font-semibold text-[var(--ember-text)]">
                      {selectedContributor.name ||
                        selectedContributor.user?.name ||
                        selectedContributor.email ||
                        selectedContributor.phoneNumber ||
                        'Contributor'}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={() => void handleSendInvite(selectedContributor.id)}
                        disabled={
                          !selectedContributorPhone ||
                          sendingContributorId === selectedContributor.id
                        }
                        className="ember-button-secondary justify-center disabled:opacity-40"
                      >
                        {sendingContributorId === selectedContributor.id
                          ? 'Sending...'
                          : 'Send SMS'}
                      </button>
                      <button
                        onClick={() => void handleStartVoiceCall(selectedContributor.id)}
                        disabled={
                          !selectedContributorPhone ||
                          callingContributorId === selectedContributor.id ||
                          getLatestVoiceCall(selectedContributor)?.status === 'registered' ||
                          getLatestVoiceCall(selectedContributor)?.status === 'ongoing'
                        }
                        className="ember-button-secondary justify-center disabled:opacity-40"
                      >
                        {callingContributorId === selectedContributor.id
                          ? 'Calling...'
                          : 'Call'}
                      </button>
                      <button
                        onClick={() => void copyLink(selectedContributor.token)}
                        className="ember-button-secondary justify-center"
                      >
                        Copy link
                      </button>
                      {!selectedContributorIsOwner && (
                        <button
                          onClick={() => void handleRemoveContributor(selectedContributor.id)}
                          className="ember-button-secondary justify-center text-rose-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {getStatusBadge(selectedContributor)}
                      {selectedContributorIsOwner && <span className="ember-chip">Creator</span>}
                      {selectedContributor.inviteSent && <span className="ember-chip">Invite sent</span>}
                    </div>

                    {selectedContributorDetail?.voiceCalls[0]?.callSummary && (
                      <div className="mt-4 rounded-[1.2rem] border border-[var(--ember-line)] bg-[rgba(247,247,244,0.7)] px-4 py-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ember-muted)]">
                          Latest call summary
                        </div>
                        <p className="mt-3 text-sm leading-7 text-[var(--ember-text)]">
                          {selectedContributorDetail.voiceCalls[0].callSummary}
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedContributorIsOwner && (
                    <div className="rounded-[1.4rem] border border-[var(--ember-line)] bg-white/80 px-4 py-4 text-sm leading-7 text-[var(--ember-muted)]">
                      This contributor record represents the Ember creator and stays
                      attached automatically.
                    </div>
                  )}

                  <div>
                    <p className="ember-eyebrow">Contributions</p>
                    <h4 className="ember-heading mt-3 text-2xl text-[var(--ember-text)]">
                      Saved answers and memory detail
                    </h4>
                  </div>

                  {detailError && (
                    <div className="ember-status ember-status-error">{detailError}</div>
                  )}

                  {detailLoading ? (
                    <div className="rounded-[1.6rem] border border-[var(--ember-line)] bg-white px-4 py-8 text-center text-sm text-[var(--ember-muted)]">
                      Loading contributions...
                    </div>
                  ) : selectedContributorDetail?.conversation?.responses.length ? (
                    <div className="space-y-3">
                      {selectedContributorDetail.conversation.responses.map((response) => (
                        <div
                          key={response.id}
                          className="ember-card rounded-[1.6rem] px-4 py-4"
                        >
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ember-muted)]">
                            {formatQuestionLabel(response.question, response.questionType)}
                          </div>
                          <p className="mt-3 text-sm leading-7 text-[var(--ember-text)]">
                            {response.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[1.6rem] border border-dashed border-[var(--ember-line-strong)] bg-white/70 px-4 py-8 text-center text-sm text-[var(--ember-muted)]">
                      No saved contributions yet for this person.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="ember-panel rounded-[2rem] p-5">
        {(error || notice) && (
          <div
            className={`mb-4 ember-status ${
              error ? 'ember-status-error' : 'ember-status-success'
            }`}
          >
            {error || notice}
          </div>
        )}

        {contributors.length === 0 ? (
          <div className="rounded-[1.6rem] border border-dashed border-[var(--ember-line-strong)] bg-white/70 px-5 py-8 text-center text-sm text-[var(--ember-muted)]">
            No contributors yet.
          </div>
        ) : (
          <div className="space-y-3">
            {contributors.map((contributor) => {
              const latestVoiceCall = getLatestVoiceCall(contributor);
              const contributorLabel =
                contributor.name ||
                contributor.user?.name ||
                contributor.email ||
                contributor.phoneNumber ||
                'Contributor';

              return (
                <div
                  key={contributor.id}
                  className="ember-card rounded-[1.5rem] px-4 py-4"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedContributorId(contributor.id)}
                    className="flex w-full items-center justify-between gap-3 text-left hover:text-[var(--ember-orange-deep)]"
                    aria-label={`Open ${contributorLabel}`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-[var(--ember-text)]">
                          {contributorLabel}
                        </p>
                        {getStatusBadge(contributor)}
                      </div>

                      {(contributor.email || contributor.phoneNumber) && (
                        <p className="mt-1 truncate text-sm text-[var(--ember-muted)]">
                          {contributor.email ||
                            formatPhoneNumber(contributor.phoneNumber || '')}
                        </p>
                      )}

                      {latestVoiceCall && (
                        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--ember-muted)]">
                          {getVoiceCallLabel(latestVoiceCall.status)}
                        </p>
                      )}
                    </div>

                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--ember-line-strong)] bg-white text-xl font-semibold text-[var(--ember-text)]">
                      +
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowAddPanel((current) => !current)}
            className="ember-button-secondary w-full justify-center gap-3"
          >
            <span className="text-lg leading-none">+</span>
            <span>{showAddPanel ? 'Close add contributor' : 'Add contributor'}</span>
          </button>
        </div>

        {showAddPanel && (
          <div className="mt-5 rounded-[1.75rem] border border-[var(--ember-line)] bg-white px-4 py-4">
            {suggestedFriends.length > 0 && (
              <div className="mb-4">
                <p className="ember-eyebrow">Quick add from friends</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestedFriends.slice(0, 8).map((friend) => (
                    <button
                      key={friend.id}
                      type="button"
                      disabled={isAdding}
                      onClick={() => void handleAddContributor({ userId: friend.id })}
                      className="ember-button-secondary min-h-0 px-4 py-2 disabled:opacity-60"
                    >
                      {friend.name || friend.email}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <label className="block text-sm text-[var(--ember-text)]">
                <div className="mb-2 font-medium">Name</div>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Contributor name"
                  className="ember-input"
                />
              </label>

              <label className="block text-sm text-[var(--ember-text)]">
                <div className="mb-2 font-medium">Email</div>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  className="ember-input"
                />
              </label>

              <label className="block text-sm text-[var(--ember-text)]">
                <div className="mb-2 font-medium">Phone</div>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) =>
                    setPhoneNumber(formatPhoneNumber(event.target.value))
                  }
                  placeholder="(555) 123-4567"
                  className="ember-input"
                />
              </label>
            </div>

            <button
              onClick={() =>
                void handleAddContributor({
                  phoneNumber: phoneNumber.replace(/\D/g, '') || null,
                  email: email.trim() || null,
                  name: name.trim() || null,
                })
              }
              disabled={isAdding || (!phoneNumber.trim() && !email.trim())}
              className="ember-button-primary mt-4 w-full disabled:opacity-60"
            >
              {isAdding ? 'Adding...' : 'Save contributor'}
            </button>
          </div>
        )}
      </div>

      {contributorDetailOverlay}
    </>
  );
}
