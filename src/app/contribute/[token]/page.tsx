'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { getEmberTitle } from '@/lib/ember-title';
import MediaPreview from '@/components/MediaPreview';
import HeaderMenu from '@/components/HeaderMenu';
import { X } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ContributorData {
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
  };
  guestFlow: boolean;
  conversation: {
    messages: Message[];
    status: string;
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
}

type ContributeMode = 'choice' | 'askChoice' | 'text' | 'voice' | 'calling';

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    isFinal?: boolean;
    0: {
      transcript: string;
    };
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

function InviteHeader() {
  return (
    <header className="ember-topbar flex h-[2.7rem] items-center justify-between px-4 text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-white">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-white">
          Home
        </Link>
        <span className="text-white/45">Invite</span>
      </div>
      <HeaderMenu
        authMode="detect"
        className="text-white/55 hover:text-white"
        panelClassName="right-0 top-[calc(100%+0.35rem)] min-w-[8.75rem] rounded-[1.1rem] border border-white/10 bg-[rgba(8,8,8,0.92)] p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.34)]"
        iconClassName="h-4.5 w-4.5"
        logoutRedirectTo="/"
      />
    </header>
  );
}

function HeroStage({
  image,
  title,
}: {
  image: ContributorData['image'];
  title: string;
}) {
  return (
    <div className="relative h-[42vh] overflow-hidden bg-[var(--ember-stage-bg)] lg:h-[56vh] lg:min-h-[30rem]">
      <MediaPreview
        mediaType={image.mediaType}
        filename={image.filename}
        posterFilename={image.posterFilename}
        originalName={title}
        controls={false}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.26),transparent_30%,transparent_60%,rgba(0,0,0,0.76))]" />
      <div className="absolute inset-x-4 bottom-4">
        <span className="ember-stage-pill">Contributor view</span>
        <div className="mt-3 text-[2rem] font-semibold uppercase leading-[0.98] tracking-[-0.05em] text-white lg:max-w-[32rem] lg:text-[3rem]">
          {title}
        </div>
      </div>
    </div>
  );
}

function PanelCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/6 text-white"
      aria-label="Close"
    >
      <X className="h-5 w-5" strokeWidth={2.5} />
    </button>
  );
}

function VoiceWaveform() {
  const bars = [12, 24, 16, 32, 20, 38, 24, 42, 28, 36, 22, 40, 26, 34, 18];

  return (
    <div className="flex items-end justify-center gap-[0.22rem] py-3">
      {bars.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className="inline-block w-[0.22rem] animate-pulse rounded-full bg-white"
          style={{
            height: `${height}px`,
            animationDelay: `${index * 80}ms`,
            animationDuration: '1200ms',
          }}
        />
      ))}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled = false,
  tone = 'pink',
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'pink' | 'rose' | 'purple' | 'pale';
}) {
  const toneClass =
    tone === 'pink'
      ? 'border border-[rgba(255,166,105,0.18)] bg-[linear-gradient(180deg,#ff9245_0%,var(--ember-orange)_100%)] text-white shadow-[0_18px_36px_rgba(255,122,26,0.22)]'
      : tone === 'rose'
        ? 'border border-white/10 bg-white/10 text-white'
        : tone === 'purple'
          ? 'border border-white/10 bg-white/6 text-white/76'
          : 'border border-white/10 bg-transparent text-white/62';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[4.35rem] rounded-[1.25rem] px-3 text-[0.84rem] font-semibold uppercase leading-5 tracking-[0.08em] ${toneClass} disabled:opacity-55`}
    >
      {label}
    </button>
  );
}

export default function ContributePage() {
  const params = useParams();
  const [data, setData] = useState<ContributorData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [mode, setMode] = useState<ContributeMode>('choice');
  const [initializedMode, setInitializedMode] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [siriEnabled, setSiriEnabled] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const fetchContributorData = useCallback(async () => {
    const response = await fetch(`/api/contribute/${params.token}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Invalid or expired link');
    }

    const result = (await response.json()) as ContributorData;
    setData(result);
    setMessages(result.conversation?.messages || []);
    setIsComplete(result.conversation?.status === 'completed');
    return result;
  }, [params.token]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await fetchContributorData();

        if (!initializedMode) {
          if (
            result.latestVoiceCall &&
            ['registered', 'ongoing'].includes(result.latestVoiceCall.status)
          ) {
            setMode('calling');
          } else if (result.conversation?.messages?.length) {
            setMode('text');
          } else {
            setMode('choice');
          }
          setInitializedMode(true);
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [fetchContributorData, initializedMode]);

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
      void fetchContributorData().catch(() => null);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [data?.latestVoiceCall, fetchContributorData]);

  useEffect(() => {
    const status = data?.latestVoiceCall?.status;

    if (status === 'registered' || status === 'ongoing') {
      setMode('calling');
      return;
    }

    if (mode === 'calling' && status && status !== 'registered' && status !== 'ongoing') {
      setMode(messages.length > 0 ? 'text' : 'choice');
    }
  }, [data?.latestVoiceCall?.status, messages.length, mode]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  const ensureConversationStarted = useCallback(async () => {
    if (messages.length > 0 || isComplete) {
      return true;
    }

    setIsSending(true);
    setActionError('');

    try {
      const response = await fetch(`/api/contribute/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '__START__' }),
      });

      if (!response.ok) {
        throw new Error('Failed to start chatting with Ember');
      }

      await fetchContributorData();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to start chatting with Ember');
      return false;
    } finally {
      setIsSending(false);
    }
  }, [fetchContributorData, isComplete, messages.length, params.token]);

  const sendUserMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || isSending) {
        return false;
      }

      const trimmed = userMessage.trim();
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
      setIsSending(true);
      setActionError('');

      try {
        const response = await fetch(`/api/contribute/${params.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const result = await response.json();
        setMessages((prev) => [...prev, { role: 'assistant', content: result.response }]);
        setIsComplete(result.isComplete);
        return true;
      } catch (err) {
        const fallback =
          err instanceof Error ? err.message : 'Sorry, something went wrong. Please try again.';
        setActionError(fallback);
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [isSending, params.token]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || isComplete) {
      return;
    }

    const userMessage = input.trim();
    setInput('');
    await sendUserMessage(userMessage);
  };

  const startPhoneCall = async () => {
    setIsCalling(true);
    setActionError('');

    try {
      const response = await fetch(`/api/contribute/${params.token}/call`, {
        method: 'POST',
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || 'Failed to start voice call');
      }

      await fetchContributorData();
      setMode('calling');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to start voice call');
    } finally {
      setIsCalling(false);
    }
  };

  const openTextMode = async () => {
    const started = await ensureConversationStarted();
    if (started) {
      setMode('text');
    }
  };

  const openVoiceMode = async () => {
    const started = await ensureConversationStarted();
    if (started) {
      setMode('voice');
    }
  };

  const startVoiceRecording = () => {
    setVoiceError('');
    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!RecognitionCtor) {
      setVoiceError('Voice recording is not available in this browser.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }

      const recognition = new RecognitionCtor();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let transcript = '';
        for (let index = 0; index < event.results.length; index += 1) {
          transcript += event.results[index][0]?.transcript || '';
        }
        setVoiceTranscript(transcript.trim());
      };

      recognition.onerror = (event) => {
        setVoiceError(event.error || 'Voice recording failed.');
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      setIsRecording(true);
      recognition.start();
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Unable to start recording.');
      setIsRecording(false);
      recognitionRef.current = null;
    }
  };

  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const submitVoiceRecording = async () => {
    if (!voiceTranscript.trim() || isComplete) {
      return;
    }

    const transcript = voiceTranscript.trim();
    setVoiceTranscript('');
    await sendUserMessage(transcript);
  };

  const contributorFirstName = useMemo(() => {
    const fullName = data?.contributor.name?.trim();
    return fullName ? fullName.split(/\s+/)[0] : 'there';
  }, [data?.contributor.name]);

  const emberTitle = useMemo(() => {
    if (!data) {
      return 'PHOTO TITLE';
    }
    return getEmberTitle(data.image).toUpperCase();
  }, [data]);

  const latestAssistantMessage =
    [...messages].reverse().find((message) => message.role === 'assistant')?.content || '';

  const recentMessages = messages.slice(-4);

  if (isLoading) {
    return (
      <main className="ember-page">
        <div className="ember-app-shell">
          <InviteHeader />
          <div className="flex min-h-[calc(100vh-2.7rem)] items-center justify-center px-4 text-sm text-white/62">
            Loading...
          </div>
        </div>
      </main>
    );
  }

  if (loadError || !data) {
    return (
      <main className="ember-page">
        <div className="ember-app-shell">
          <InviteHeader />
          <div className="px-4 py-6">
            <div className="ember-stage-section px-5 py-6 text-white">
              <span className="ember-stage-pill">Invite expired</span>
              <h1 className="mt-4 text-[2rem] font-semibold tracking-[-0.05em]">Link not found</h1>
              <p className="mt-3 text-sm leading-7 text-white/56">
                {loadError || 'This link may have expired or is invalid.'}
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="ember-page">
      <div className="ember-app-shell">
        <InviteHeader />
        <HeroStage image={data.image} title={emberTitle} />

        {(mode === 'choice' || mode === 'askChoice' || mode === 'calling') && (
          <section className="min-h-[calc(100vh-2.7rem-42vh)] px-4 py-5 text-white lg:px-6 lg:py-8">
            <div className="ember-stage-section mx-auto max-w-[58rem] p-5 lg:p-8">
          {actionError && (
              <div className="mb-5 rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-3 text-sm font-medium text-white">
              {actionError}
              </div>
          )}

          {mode === 'choice' && (
            <>
              <span className="ember-stage-pill">Choose a mode</span>
              <p className="mx-auto mt-4 max-w-[18.5rem] text-center text-[1.35rem] font-medium leading-[1.22] tracking-[-0.04em] lg:max-w-[32rem] lg:text-[1.62rem]">
                Hello {contributorFirstName}! How would you like to conduct this interview?
              </p>
              <div className="mx-auto mt-8 grid max-w-[21rem] grid-cols-3 gap-2 lg:max-w-[34rem] lg:gap-3">
                <ActionButton
                  label="PHONE CALL"
                  onClick={() => void startPhoneCall()}
                  disabled={isCalling}
                  tone="rose"
                />
                <ActionButton label="ASK EMBER" onClick={() => setMode('askChoice')} tone="pink" />
                <div className="flex flex-col items-center">
                  <ActionButton label="VIDEO CALL" disabled tone="purple" />
                  <span className="mt-2 text-[0.95rem] text-[#bed8e2]">coming soon</span>
                </div>
              </div>
            </>
          )}

          {mode === 'askChoice' && (
            <>
              <span className="ember-stage-pill">Ask Ember</span>
              <p className="mx-auto mt-4 max-w-[18.5rem] text-center text-[1.35rem] font-medium leading-[1.22] tracking-[-0.04em] lg:max-w-[32rem] lg:text-[1.62rem]">
                {contributorFirstName}, choose how you would like to chat with ember.
              </p>
              <div className="mx-auto mt-8 grid max-w-[21rem] grid-cols-3 gap-2 lg:max-w-[34rem] lg:gap-3">
                <ActionButton label="BACK" onClick={() => setMode('choice')} tone="pale" />
                <ActionButton
                  label="TEXT"
                  onClick={() => void openTextMode()}
                  disabled={isSending}
                  tone="pink"
                />
                <ActionButton
                  label="VOICE"
                  onClick={() => void openVoiceMode()}
                  disabled={isSending}
                  tone="rose"
                />
              </div>
            </>
          )}

          {mode === 'calling' && (
            <div className="flex min-h-[calc(100vh-2.7rem-42vh-4rem)] items-center justify-center text-center">
              <div>
                <span className="ember-stage-pill">Phone interview</span>
                <p className="mx-auto mt-4 max-w-[16rem] text-[1.42rem] font-medium leading-[1.25] tracking-[-0.04em] lg:max-w-[24rem] lg:text-[1.68rem]">
                  Ember is calling you now! Thank you!
                </p>
                {data.latestVoiceCall && (
                  <p className="mt-4 text-[1rem] text-white/62">
                    {data.latestVoiceCall.status === 'ongoing'
                      ? 'Your phone conversation is in progress.'
                      : 'Stay on this page while the call connects.'}
                  </p>
                )}
              </div>
            </div>
          )}
            </div>
          </section>
        )}

        {mode === 'text' && (
          <section className="flex min-h-[calc(100vh-2.7rem-42vh)] flex-col px-4 pt-4 pb-5 text-white lg:px-6 lg:py-8">
            <div className="ember-stage-section mx-auto flex min-h-full w-full max-w-[58rem] flex-1 flex-col p-4 lg:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <span className="ember-stage-pill">Text interview</span>
                  <div className="mt-4 text-[1.05rem] font-semibold tracking-[-0.03em]">Text Ember</div>
                </div>
                <PanelCloseButton onClick={() => setMode('askChoice')} />
              </div>

          {actionError && (
                <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-3 text-sm font-medium text-white">
              {actionError}
                </div>
          )}

              <div className="mt-4 rounded-[1.3rem] border border-white/10 bg-white/6 px-4 py-4 text-[1.05rem] leading-[1.5] text-white">
            {latestAssistantMessage}
              </div>

              <div className="mt-4 flex-1">
            {recentMessages.length > 1 && (
                <div className="max-h-[28vh] overflow-y-auto pr-1 text-[0.98rem] leading-7 text-white/72 lg:max-h-[32vh]">
                {recentMessages.map((message, index) => (
                  <p key={`${message.role}-${index}`} className={index === 0 ? '' : 'mt-3'}>
                    {message.content}
                  </p>
                ))}
                </div>
            )}
              </div>

              <form onSubmit={handleSubmit} className="mt-5">
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Type your answer"
                  enterKeyHint="send"
                  autoFocus
                  className="ember-input min-h-[3.35rem] px-4 text-[1rem] placeholder:text-white/30"
                  disabled={isSending || isComplete}
                />
              </form>

              {isComplete && (
                <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-4 text-center text-[1rem] leading-7 text-white">
              Thanks. Ember saved your contribution and updated the memory.
                </div>
              )}
            </div>
          </section>
        )}

        {mode === 'voice' && (
          <section className="flex min-h-[calc(100vh-2.7rem-42vh)] flex-col px-4 pt-4 pb-5 text-white lg:px-6 lg:py-8">
            <div className="ember-stage-section mx-auto flex min-h-full w-full max-w-[58rem] flex-1 flex-col p-4 lg:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <span className="ember-stage-pill">Voice interview</span>
                  <div className="mt-4 text-[1.05rem] font-semibold tracking-[-0.03em]">
              Talk with Ember
              {data.contributor.name ? ` | ${data.contributor.name}` : ''}
                  </div>
                </div>
                <PanelCloseButton onClick={() => setMode('askChoice')} />
              </div>

              <VoiceWaveform />

              <div className="mt-1 rounded-[1.3rem] border border-white/10 bg-white/6 px-4 py-4 text-[1.02rem] leading-[1.5] text-white">
            {latestAssistantMessage}
              </div>

              <div className="mt-4 flex-1">
            {voiceTranscript && (
                <div className="rounded-[1.15rem] border border-white/10 bg-white/8 px-4 py-3 text-left text-sm leading-6 text-white">
                {voiceTranscript}
                </div>
            )}
            {voiceError && (
                <div className="mt-4 rounded-[1.15rem] border border-white/10 bg-white/8 px-4 py-3 text-left text-sm leading-6 text-white">
                {voiceError}
                </div>
            )}
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2">
            <ActionButton
              label={siriEnabled ? 'SIRI ON' : 'SIRI OFF'}
              onClick={() => setSiriEnabled((current) => !current)}
              tone="purple"
            />
            <ActionButton
              label={isRecording ? 'STOP' : 'RECORD'}
              onClick={() => {
                if (isRecording) {
                  stopVoiceRecording();
                } else {
                  startVoiceRecording();
                }
              }}
              tone="pink"
            />
            <ActionButton
              label="SUBMIT"
              onClick={() => void submitVoiceRecording()}
              disabled={!voiceTranscript.trim() || isSending || isComplete}
              tone="rose"
            />
              </div>

              {isComplete && (
                <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-4 text-center text-[1rem] leading-7 text-white">
              Thanks. Ember saved your contribution and updated the memory.
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
