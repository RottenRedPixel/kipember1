'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type VoiceCallState = {
  id: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  callSummary: string | null;
  memorySyncedAt: string | null;
};

function getVoiceStatusLabel(voiceCall: VoiceCallState) {
  if (voiceCall.memorySyncedAt) {
    return 'Your phone conversation finished and Ember folded it into the memory.';
  }

  switch (voiceCall.status) {
    case 'registered':
      return 'Ember is dialing your phone now.';
    case 'ongoing':
      return 'Your conversation with Ember is in progress.';
    case 'ended':
      return voiceCall.callSummary
        ? 'Your call finished. Ember is updating the memory now.'
        : 'Your last phone call ended.';
    case 'not_connected':
      return 'Ember could not connect the phone call.';
    case 'error':
      return 'The phone call hit an error.';
    default:
      return `Phone call status: ${voiceCall.status}`;
  }
}

export default function MemoryTellMoreActions({
  contributorToken,
  contributorId,
  phoneAvailable,
  latestVoiceCall,
  onRefreshRequested,
  className = '',
}: {
  contributorToken: string | null;
  contributorId: string | null;
  phoneAvailable: boolean;
  latestVoiceCall: VoiceCallState | null;
  onRefreshRequested?: () => Promise<void> | void;
  className?: string;
}) {
  const [isCalling, setIsCalling] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!latestVoiceCall) {
      return;
    }

    if (
      latestVoiceCall.memorySyncedAt ||
      !['registered', 'ongoing', 'ended'].includes(latestVoiceCall.status)
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void onRefreshRequested?.();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [latestVoiceCall, onRefreshRequested]);

  useEffect(() => {
    if (!error && !notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setError('');
      setNotice('');
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [error, notice]);

  if (!contributorToken || !contributorId) {
    return null;
  }

  const callActive =
    latestVoiceCall?.status === 'registered' || latestVoiceCall?.status === 'ongoing';

  const startPhoneCall = async () => {
    if (!contributorId || isCalling || !phoneAvailable) {
      return;
    }

    setIsCalling(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/voice/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorId }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to start phone call');
      }

      setNotice('Ember is calling you now.');
      await onRefreshRequested?.();
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : 'Failed to start phone call');
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div className="flex flex-wrap gap-3">
        <Link href={`/contribute/${contributorToken}`} className="ember-button-primary">
          Chat Via Text
        </Link>
        <button
          type="button"
          onClick={() => void startPhoneCall()}
          disabled={isCalling || callActive || !phoneAvailable}
          className="ember-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCalling ? 'Calling...' : callActive ? 'Call in progress' : 'Talk Via Phone'}
        </button>
      </div>

      {!phoneAvailable && (
        <div className="text-sm text-[var(--ember-muted)]">
          Add a phone number to your profile if you want Ember to call you about this memory.
        </div>
      )}

      {latestVoiceCall && (
        <div className="text-sm text-[var(--ember-muted)]">{getVoiceStatusLabel(latestVoiceCall)}</div>
      )}

      {notice && <div className="text-sm text-[var(--ember-muted)]">{notice}</div>}
      {error && <div className="text-sm text-rose-600">{error}</div>}
    </div>
  );
}
