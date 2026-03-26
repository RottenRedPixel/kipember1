'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getEmberTitle } from '@/lib/ember-title';
import MediaPreview from '@/components/MediaPreview';
import WikiView from '@/components/WikiView';

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

type GuestMemoryResponse = {
  guestFlow: true;
  contributor: {
    id: string;
    name: string | null;
    phoneNumber: string | null;
  };
  image: {
    id: string;
    filename: string;
    mediaType: 'IMAGE' | 'VIDEO';
    posterFilename: string | null;
    durationSeconds: number | null;
    originalName: string;
    title: string | null;
    description: string | null;
    createdAt: string;
  };
  analysis: {
    status: string;
    summary: string | null;
    visualDescription: string | null;
    mood: string | null;
    errorMessage: string | null;
  } | null;
  conversation: {
    status: string;
    currentStep: string;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      createdAt: string;
    }>;
  } | null;
  latestVoiceCall: {
    id: string;
    status: string;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
    callSummary: string | null;
    memorySyncedAt: string | null;
  } | null;
  wiki: {
    id: string;
    content: string;
    version: number;
    updatedAt: string;
  } | null;
};

function voiceStatusLabel(call: GuestMemoryResponse['latestVoiceCall']) {
  if (!call) {
    return '';
  }

  if (call.memorySyncedAt) {
    return 'Your call finished and Ember added it to the memory.';
  }

  switch (call.status) {
    case 'registered':
      return 'Ember is dialing your phone now.';
    case 'ongoing':
      return 'Your conversation with Ember is in progress.';
    case 'ended':
      return 'Your call ended. Ember is turning it into memory context now.';
    case 'not_connected':
      return 'We could not connect the call. Try again in a moment.';
    case 'error':
      return 'The phone interview hit an error.';
    default:
      return `Phone status: ${status}`;
  }
}

export default function GuestMemoryExperience({ token }: { token: string }) {
  const [data, setData] = useState<GuestMemoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCallSheet, setShowCallSheet] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callError, setCallError] = useState('');
  const [isCalling, setIsCalling] = useState(false);

  const fetchGuestMemory = useCallback(async () => {
    try {
      const response = await fetch(`/api/guest/${token}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Unable to load this memory');
      }

      const payload = (await response.json()) as GuestMemoryResponse;
      setData(payload);
      setPhoneNumber((current) => current || payload.contributor.phoneNumber || '');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this memory');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchGuestMemory();
  }, [fetchGuestMemory]);

  useEffect(() => {
    if (!data?.latestVoiceCall) {
      return;
    }

    if (
      data.latestVoiceCall.memorySyncedAt ||
      !['registered', 'ongoing', 'ended'].includes(data.latestVoiceCall.status)
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchGuestMemory();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [data?.latestVoiceCall, fetchGuestMemory]);

  const emberTitle = data
    ? getEmberTitle({
        title: data.image.title,
        originalName: data.image.originalName,
      })
    : '';

  const quickRead = useMemo(() => {
    if (!data) {
      return '';
    }

    return (
      data.analysis?.visualDescription ||
      data.analysis?.summary ||
      data.image.description ||
      'Ember is still reading the scene and preparing the first memory draft.'
    );
  }, [data]);

  const memoryReady = Boolean(
    data?.conversation?.status === 'completed' ||
      data?.latestVoiceCall?.memorySyncedAt
  );

  const startGuestCall = async () => {
    setIsCalling(true);
    setCallError('');

    try {
      const response = await fetch(`/api/guest/${token}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to start call');
      }

      setShowCallSheet(false);
      await fetchGuestMemory();
    } catch (err) {
      setCallError(err instanceof Error ? err.message : 'Failed to start call');
    } finally {
      setIsCalling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center justify-center px-4 py-10 sm:px-6">
        <div className="ember-panel rounded-full px-6 py-3 text-sm text-[var(--ember-muted)]">
          Loading your memory...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center justify-center px-4 py-10 sm:px-6">
        <div className="ember-panel w-full max-w-xl rounded-[2rem] p-8 text-center">
          <p className="ember-eyebrow">Guest memory</p>
          <h1 className="ember-heading mt-4 text-4xl text-[var(--ember-text)]">
            Memory not found
          </h1>
          <p className="ember-copy mt-4 text-sm">{error || 'This memory is no longer available.'}</p>
          <Link href="/" className="ember-button-primary mt-6 px-6">
            Back to Ember
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {showCallSheet && (
        <div className="fixed inset-0 z-[80] bg-[rgba(17,17,17,0.62)] px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto flex min-h-full w-full max-w-lg items-end justify-center sm:items-center">
            <div className="ember-panel-strong w-full rounded-[2rem] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="ember-eyebrow">Phone interview</p>
                  <h2 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">
                    Have Ember call you
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCallSheet(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ember-line)] bg-white text-[var(--ember-text)]"
                  aria-label="Close"
                >
                  <CloseIcon />
                </button>
              </div>

              <p className="ember-copy mt-4 text-sm">
                Enter your phone number and Ember will call to interview you about this moment. If you later create an account with the same number, this memory can come with you.
              </p>

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
                  Phone number
                </span>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="(555) 555-5555"
                  className="ember-input"
                />
              </label>

              {callError && (
                <div className="ember-status ember-status-error mt-4">{callError}</div>
              )}

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={startGuestCall}
                  disabled={isCalling}
                  className="ember-button-primary flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCalling ? 'Calling...' : 'Call me'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCallSheet(false)}
                  className="ember-button-secondary flex-1"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[0.94fr_1.06fr]">
        <section className="ember-panel min-w-0 rounded-[2rem] p-5 sm:p-6">
          <p className="ember-eyebrow">Quick read</p>
          <h1 className="ember-heading mt-4 break-words text-4xl text-[var(--ember-text)] sm:text-5xl">
            Bring your memory to life
          </h1>
          <p className="ember-copy mt-4 text-sm">
            Ember started with what the photo shows. Now add the human side of the story so the memory becomes something more than an image in the camera roll.
          </p>

          <div className="ember-card mt-6 ember-photo-shell">
            <MediaPreview
              mediaType={data.image.mediaType}
              filename={data.image.filename}
              posterFilename={data.image.posterFilename}
              originalName={emberTitle}
              controls={data.image.mediaType === 'VIDEO'}
              className="max-h-[34rem] w-full object-contain bg-[var(--ember-charcoal)]"
            />
          </div>

          <div className="mt-5 min-w-0">
            <h2 className="ember-heading break-words text-2xl text-[var(--ember-text)] sm:text-3xl">
              {emberTitle}
            </h2>
            <p className="ember-copy mt-3 text-sm leading-7">{quickRead}</p>
          </div>

          <div className="mt-6 grid gap-3">
            <Link href={`/contribute/${token}`} className="ember-button-primary w-full">
              Talk to Ember
            </Link>
            <button
              type="button"
              onClick={() => setShowCallSheet(true)}
              className="ember-button-secondary w-full"
            >
              Get a phone call
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="ember-chip">Quick visual description</span>
            <span className="ember-chip">Text or phone interview</span>
            <span className="ember-chip">Claim later by phone</span>
          </div>
        </section>

        <section className="min-w-0 space-y-6">
          {data.latestVoiceCall && (
            <div className="ember-status ember-status-success">
              {voiceStatusLabel(data.latestVoiceCall)}
            </div>
          )}

          <div className="ember-panel rounded-[2rem] p-6">
            <p className="ember-eyebrow">What Ember is doing</p>
            <div className="mt-4 space-y-3">
              <div className="ember-card rounded-[1.4rem] px-4 py-4">
                <div className="text-sm font-semibold text-[var(--ember-text)]">
                  1. Reading the scene
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">
                  Ember writes a grounded first description based on what it can actually see.
                </p>
              </div>
              <div className="ember-card rounded-[1.4rem] px-4 py-4">
                <div className="text-sm font-semibold text-[var(--ember-text)]">
                  2. Interviewing the memory
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">
                  Your voice, details, and backstory are what turn the image into a memory instead of a caption.
                </p>
              </div>
              <div className="ember-card rounded-[1.4rem] px-4 py-4">
                <div className="text-sm font-semibold text-[var(--ember-text)]">
                  3. Building the Ember
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">
                  Once the conversation finishes, Ember folds everything into one memory record you can keep if you create an account.
                </p>
              </div>
            </div>
          </div>

          <div className="ember-panel rounded-[2rem] p-6">
            <p className="ember-eyebrow">
              {memoryReady ? 'Memory preview' : 'First memory draft'}
            </p>
            <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)]">
              {memoryReady ? 'Your Ember is coming together' : 'Ember has a quick start'}
            </h2>
            <p className="ember-copy mt-3 text-sm">
              {memoryReady
                ? 'This is the living memory Ember is building from the image and the conversation.'
                : 'After you talk with Ember, this draft will expand with the why, who, and what the moment meant.'}
            </p>

            {data.wiki ? (
              <div className="mt-6 min-w-0 rounded-[1.6rem] border border-[rgba(20,20,20,0.06)] bg-white/70 px-5 py-5">
                <WikiView content={data.wiki.content} />
              </div>
            ) : (
              <div className="ember-card mt-6 rounded-[1.6rem] px-5 py-5">
                <p className="text-sm leading-7 text-[var(--ember-muted)]">{quickRead}</p>
              </div>
            )}
          </div>

          <div className="ember-panel rounded-[2rem] p-6">
            <p className="ember-eyebrow">Keep it</p>
            <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)]">
              Want to keep this memory?
            </h2>
            <p className="ember-copy mt-3 text-sm">
              Create an account to keep building your Embers. If you used the phone interview, signing up with that same number lets Ember reconnect this memory for you.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="ember-button-primary flex-1">
                Create account
              </Link>
              <Link href="/login" className="ember-button-secondary flex-1">
                I already have an account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
