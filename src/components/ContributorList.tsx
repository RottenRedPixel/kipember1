'use client';

import { useState } from 'react';

interface Contributor {
  id: string;
  phoneNumber: string;
  name: string | null;
  token: string;
  inviteSent: boolean;
  conversation: {
    status: string;
    currentStep: string;
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

interface ContributorListProps {
  imageId: string;
  contributors: Contributor[];
  onUpdate: () => void;
}

export default function ContributorList({
  imageId,
  contributors,
  onUpdate,
}: ContributorListProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [callingContributorId, setCallingContributorId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handleAddContributor = async () => {
    if (!phoneNumber.trim()) return;

    setIsAdding(true);
    setError('');

    try {
      const response = await fetch('/api/contributors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId,
          phoneNumber: phoneNumber.replace(/\D/g, ''),
          name: name.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add contributor');
      }

      setPhoneNumber('');
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
      await fetch(`/api/contributors?id=${id}`, { method: 'DELETE' });
      onUpdate();
    } catch (err) {
      console.error('Failed to remove contributor:', err);
    }
  };

  const handleSendInvites = async () => {
    if (contributors.length === 0) return;

    setIsSending(true);
    setError('');

    try {
      const response = await fetch('/api/twilio/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send invites');
      }

      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invites');
    } finally {
      setIsSending(false);
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

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start voice call');
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
        <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
          Completed
        </span>
      );
    }

    if (contributor.conversation?.status === 'active') {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
          In progress
        </span>
      );
    }

    if (contributor.inviteSent) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">
          Invited
        </span>
      );
    }

    return (
      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
        Not invited
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
    alert('Link copied!');
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Contributors
      </h2>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
          placeholder="Phone number"
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={handleAddContributor}
          disabled={isAdding || !phoneNumber.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
        >
          {isAdding ? 'Adding...' : 'Add'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {contributors.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          No contributors yet. Add phone numbers above.
        </p>
      ) : (
        <div className="space-y-3 mb-6">
          {contributors.map((contributor) => {
            const latestVoiceCall = getLatestVoiceCall(contributor);

            return (
              <div
                key={contributor.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {contributor.name || 'Anonymous'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatPhoneNumber(contributor.phoneNumber)}
                    </p>
                    {latestVoiceCall && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {getVoiceCallLabel(latestVoiceCall.status)}
                      </p>
                    )}
                  </div>
                  {getStatusBadge(contributor)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartVoiceCall(contributor.id)}
                    disabled={
                      callingContributorId === contributor.id ||
                      latestVoiceCall?.status === 'registered' ||
                      latestVoiceCall?.status === 'ongoing'
                    }
                    className="text-emerald-600 hover:text-emerald-700 disabled:text-emerald-300 p-2 text-sm"
                    title="Start voice interview"
                  >
                    {callingContributorId === contributor.id ? 'Calling...' : 'Call Now'}
                  </button>
                  <button
                    onClick={() => copyLink(contributor.token)}
                    className="text-blue-500 hover:text-blue-700 p-2 text-sm"
                    title="Copy invite link"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => handleRemoveContributor(contributor.id)}
                    className="text-red-500 hover:text-red-700 p-2"
                    title="Remove contributor"
                  >
                    X
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {contributors.length > 0 && (
        <>
          {contributors.filter((c) => !c.inviteSent).length > 0 ? (
            <button
              onClick={handleSendInvites}
              disabled={isSending}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
            >
              {isSending
                ? 'Sending...'
                : `Send SMS Invites (${contributors.filter((c) => !c.inviteSent).length})`}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                All invites sent! Use &quot;Copy Link&quot; to manually share.
              </p>
              <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                Retell voice calls can also be started per contributor above.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
