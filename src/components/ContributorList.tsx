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
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contributor');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveContributor = async (id: string) => {
    try {
      const response = await fetch(`/api/contributors?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Failed to remove contributor');
      }
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove contributor');
    }
  };

  const handleSendInvite = async (contributorId: string) => {
    setSendingContributorId(contributorId);
    setError('');

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

      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start voice call');
    } finally {
      setCallingContributorId(null);
    }
  };

  const getStatusBadge = (contributor: Contributor) => {
    if (contributor.conversation?.status === 'completed') {
      return (
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          Completed
        </span>
      );
    }

    if (contributor.conversation?.status === 'active') {
      return (
        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
          In progress
        </span>
      );
    }

    if (contributor.inviteSent) {
      return (
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          Invited
        </span>
      );
    }

    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
        Added
      </span>
    );
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

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/contribute/${token}`;
    navigator.clipboard.writeText(url);
    alert('Link copied');
  };

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">Contributors</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Add people manually or pull them straight from your Ember network.
      </p>

      {suggestedFriends.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Quick add from friends
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestedFriends.slice(0, 8).map((friend) => (
              <button
                key={friend.id}
                type="button"
                disabled={isAdding}
                onClick={() => handleAddContributor({ userId: friend.id })}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950 disabled:opacity-60"
              >
                {friend.name || friend.email}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
        />
        <input
          type="tel"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(formatPhoneNumber(event.target.value))}
          placeholder="Phone number"
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
        />
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
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
        className="mt-3 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {isAdding ? 'Adding...' : 'Add contributor'}
      </button>

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {contributors.length === 0 ? (
        <p className="py-8 text-center text-slate-500">
          No contributors yet. Add people above.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {contributors.map((contributor) => {
            const latestVoiceCall = getLatestVoiceCall(contributor);
            const hasPhone = Boolean(contributor.phoneNumber);

            return (
              <div
                key={contributor.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-slate-950">
                      {contributor.name || contributor.email || contributor.phoneNumber || 'Contributor'}
                    </p>
                    {getStatusBadge(contributor)}
                  </div>
                  {contributor.user && (
                    <p className="mt-1 text-sm text-sky-700">
                      Linked account: {contributor.user.name || contributor.user.email}
                    </p>
                  )}
                  {contributor.phoneNumber && (
                    <p className="mt-1 text-sm text-slate-500">
                      {formatPhoneNumber(contributor.phoneNumber)}
                    </p>
                  )}
                  {contributor.email && (
                    <p className="mt-1 text-sm text-slate-500">{contributor.email}</p>
                  )}
                  {latestVoiceCall && (
                    <p className="mt-1 text-xs text-slate-500">
                      {getVoiceCallLabel(latestVoiceCall.status)}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleSendInvite(contributor.id)}
                    disabled={!hasPhone || sendingContributorId === contributor.id}
                    className="text-sm font-medium text-indigo-600 transition hover:text-indigo-700 disabled:text-indigo-300"
                    title={hasPhone ? 'Send text invite' : 'Phone number required for SMS'}
                  >
                    {sendingContributorId === contributor.id
                      ? 'Sending...'
                      : contributor.inviteSent
                        ? 'Resend Text'
                        : 'Send Text'}
                  </button>
                  <button
                    onClick={() => handleStartVoiceCall(contributor.id)}
                    disabled={
                      !hasPhone ||
                      callingContributorId === contributor.id ||
                      latestVoiceCall?.status === 'registered' ||
                      latestVoiceCall?.status === 'ongoing'
                    }
                    className="text-sm font-medium text-emerald-600 transition hover:text-emerald-700 disabled:text-emerald-300"
                    title={hasPhone ? 'Start voice interview' : 'Phone number required for voice calls'}
                  >
                    {callingContributorId === contributor.id ? 'Calling...' : 'Call Now'}
                  </button>
                  <button
                    onClick={() => copyLink(contributor.token)}
                    className="text-sm font-medium text-sky-600 transition hover:text-sky-700"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => handleRemoveContributor(contributor.id)}
                    className="text-sm font-medium text-rose-600 transition hover:text-rose-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
