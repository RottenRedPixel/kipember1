'use client';

import { useMemo, useState } from 'react';

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

interface ContributorListProps {
  imageId: string;
  contributors: Contributor[];
  friends: FriendSuggestion[];
  onUpdate: () => void;
}

export default function ContributorList({
  imageId,
  contributors,
  friends,
  onUpdate,
}: ContributorListProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [sendingContributorId, setSendingContributorId] = useState<string | null>(null);
  const [callingContributorId, setCallingContributorId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const existingFriendIds = useMemo(
    () => new Set(contributors.map((contributor) => contributor.userId).filter(Boolean)),
    [contributors]
  );

  const suggestedFriends = friends.filter((friend) => !existingFriendIds.has(friend.id));

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

  return (
    <div className="ember-panel rounded-[2rem] p-6">
      <div className="mb-4">
        <p className="ember-eyebrow">Contributors</p>
        <h2 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">Manage the memory circle</h2>
        <p className="ember-copy mt-2 text-sm">
          Add people manually or pull them in from your Ember network, then invite them by text or start a call.
        </p>
      </div>

      {suggestedFriends.length > 0 && (
        <div className="mb-5">
          <p className="ember-eyebrow">Quick add from friends</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestedFriends.slice(0, 8).map((friend) => (
              <button
                key={friend.id}
                type="button"
                disabled={isAdding}
                onClick={() => handleAddContributor({ userId: friend.id })}
                className="ember-button-secondary min-h-0 px-4 py-2 disabled:opacity-60"
              >
                {friend.name || friend.email}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          className="ember-input"
        />
        <input
          type="tel"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(formatPhoneNumber(event.target.value))}
          placeholder="Phone number"
          className="ember-input"
        />
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="ember-input"
        />
      </div>
      <button
        onClick={() =>
          handleAddContributor({
            phoneNumber: phoneNumber.replace(/\D/g, '') || null,
            email: email.trim() || null,
            name: name.trim() || null,
          })
        }
        disabled={isAdding || (!phoneNumber.trim() && !email.trim())}
        className="ember-button-primary mt-3 disabled:opacity-60"
      >
        {isAdding ? 'Adding...' : 'Add contributor'}
      </button>

      {(error || notice) && (
        <div className={`mt-4 ember-status ${error ? 'ember-status-error' : 'ember-status-success'}`}>
          {error || notice}
        </div>
      )}

      {contributors.length === 0 ? (
        <p className="py-8 text-center text-[var(--ember-muted)]">No contributors yet. Add people above.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {contributors.map((contributor) => {
            const latestVoiceCall = getLatestVoiceCall(contributor);
            const hasPhone = Boolean(contributor.phoneNumber);

            return (
              <div
                key={contributor.id}
                className="ember-card flex flex-col gap-4 rounded-[1.5rem] px-4 py-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[var(--ember-text)]">
                        {contributor.name || contributor.email || contributor.phoneNumber || 'Contributor'}
                      </p>
                      {getStatusBadge(contributor)}
                    </div>
                    {contributor.user && (
                      <p className="mt-1 text-sm text-[var(--ember-orange-deep)]">
                        Linked account: {contributor.user.name || contributor.user.email}
                      </p>
                    )}
                    {contributor.phoneNumber && (
                      <p className="mt-1 text-sm text-[var(--ember-muted)]">
                        {formatPhoneNumber(contributor.phoneNumber)}
                      </p>
                    )}
                    {contributor.email && (
                      <p className="mt-1 text-sm text-[var(--ember-muted)]">{contributor.email}</p>
                    )}
                    {latestVoiceCall && (
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--ember-muted)]">
                        {getVoiceCallLabel(latestVoiceCall.status)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleSendInvite(contributor.id)}
                      disabled={!hasPhone || sendingContributorId === contributor.id}
                      className="ember-button-secondary min-h-0 px-4 py-2 text-[var(--ember-orange-deep)] disabled:opacity-40"
                      title={hasPhone ? 'Send text invite' : 'Phone number required for SMS'}
                    >
                      {sendingContributorId === contributor.id
                        ? 'Sending...'
                        : contributor.inviteSent
                          ? 'Resend text'
                          : 'Send text'}
                    </button>
                    <button
                      onClick={() => handleStartVoiceCall(contributor.id)}
                      disabled={
                        !hasPhone ||
                        callingContributorId === contributor.id ||
                        latestVoiceCall?.status === 'registered' ||
                        latestVoiceCall?.status === 'ongoing'
                      }
                      className="ember-button-secondary min-h-0 px-4 py-2 disabled:opacity-40"
                      title={hasPhone ? 'Start voice interview' : 'Phone number required for voice calls'}
                    >
                      {callingContributorId === contributor.id ? 'Calling...' : 'Call now'}
                    </button>
                    <button
                      onClick={() => void copyLink(contributor.token)}
                      className="ember-button-secondary min-h-0 px-4 py-2"
                    >
                      Copy link
                    </button>
                    <button
                      onClick={() => handleRemoveContributor(contributor.id)}
                      className="ember-button-secondary min-h-0 px-4 py-2 text-rose-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
