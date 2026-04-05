'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { getEmberTitle } from '@/lib/ember-title';
import MediaPreview from '@/components/MediaPreview';
import HeaderMenu from '@/components/HeaderMenu';

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
    <header className="flex h-[2.65rem] items-center justify-between bg-[#9e9e9e] px-4 text-[0.95rem] font-medium uppercase tracking-[-0.03em] text-white">
      <Link href="/" className="hover:opacity-80">
        Home
      </Link>
      <HeaderMenu
        authMode="detect"
        className="text-white hover:opacity-80"
        panelClassName="right-0 top-[calc(100%+0.35rem)] min-w-[8.75rem] rounded-[0.9rem] border border-white/12 bg-[#6e6e6e] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
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
    <div className="relative h-[44vh] overflow-hidden border-t-2 border-white bg-[#9cc9ca]">
      <MediaPreview
        mediaType={image.mediaType}
        filename={image.filename}
        posterFilename={image.posterFilename}
        originalName={title}
        controls={false}
        className={`h-full w-full ${
          image.mediaType === 'VIDEO'
            ? 'object-cover bg-[#9cc9ca]'
            : 'object-cover bg-[#9cc9ca]'
        }`}
      />
      <div className="absolute inset-0 bg-[#9cc9ca]/72" />
      <div className="absolute left-3 top-5 right-3 text-[2rem] font-semibold uppercase tracking-[-0.05em] text-white">
        {title}
      </div>
    </div>
  );
}

function PanelCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center text-white"
      aria-label="Close"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
        <path d="M6 6 18 18" />
        <path d="M18 6 6 18" />
      </svg>
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
      ? 'bg-[#e25588] text-white'
      : tone === 'rose'
        ? 'bg-[#d75a89] text-white'
        : tone === 'purple'
          ? 'bg-[#7f63a7] text-white'
          : 'bg-[#f1d8e5] text-[#e25588]';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[4.9rem] px-2 text-[0.97rem] font-semibold uppercase leading-5 tracking-[-0.02em] ${toneClass} disabled:opacity-55`}
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
    [...messages].reverse().find((message) => message.role === 'assistant')?.content ||
    `Hi ${contributorFirstName}! I'm Ember. Thanks for sharing your memory.`;

  const recentMessages = messages.slice(-4);

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[26rem] bg-white">
        <InviteHeader />
        <div className="flex min-h-[calc(100vh-2.65rem)] items-center justify-center text-[#2f2f2f]">
          Loading...
        </div>
      </main>
    );
  }

  if (loadError || !data) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[26rem] bg-white">
        <InviteHeader />
        <div className="px-5 py-10 text-[#1f1f1f]">
          <h1 className="text-[2rem] font-semibold tracking-[-0.04em]">Link not found</h1>
          <p className="mt-3 text-base">{loadError || 'This link may have expired or is invalid.'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[26rem] bg-white">
      <InviteHeader />
      <HeroStage image={data.image} title={emberTitle} />

      {(mode === 'choice' || mode === 'askChoice' || mode === 'calling') && (
        <section className="min-h-[calc(100vh-2.65rem-44vh)] border-t-2 border-white bg-[#3f8ab0] px-4 py-6 text-white">
          {actionError && (
            <div className="mb-5 bg-white/18 px-4 py-3 text-sm font-medium text-white">
              {actionError}
            </div>
          )}

          {mode === 'choice' && (
            <>
              <p className="mx-auto max-w-[18.5rem] text-center text-[1.25rem] font-medium leading-[1.28] tracking-[-0.03em]">
                Hello {contributorFirstName}! How would you like to conduct this interview?
              </p>
              <div className="mx-auto mt-8 grid max-w-[21rem] grid-cols-3 gap-[0.18rem]">
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
              <p className="mx-auto max-w-[18.5rem] text-center text-[1.25rem] font-medium leading-[1.28] tracking-[-0.03em]">
                {contributorFirstName}, choose how you would like to chat with ember.
              </p>
              <div className="mx-auto mt-8 grid max-w-[21rem] grid-cols-3 gap-[0.18rem]">
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
            <div className="flex min-h-[calc(100vh-2.65rem-44vh-3rem)] items-center justify-center text-center">
              <div>
                <p className="mx-auto max-w-[16rem] text-[1.42rem] font-medium leading-[1.25] tracking-[-0.04em]">
                  Ember is calling you now! Thank you!
                </p>
                {data.latestVoiceCall && (
                  <p className="mt-4 text-[1rem] text-white/82">
                    {data.latestVoiceCall.status === 'ongoing'
                      ? 'Your phone conversation is in progress.'
                      : 'Stay on this page while the call connects.'}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {mode === 'text' && (
        <section className="flex min-h-[calc(100vh-2.65rem-44vh)] flex-col border-t-2 border-white bg-[#3f8ab0] px-3 pt-4 pb-5 text-white">
          <div className="flex items-start justify-between">
            <div className="text-[1.05rem] font-semibold tracking-[-0.03em]">Text Ember</div>
            <PanelCloseButton onClick={() => setMode('askChoice')} />
          </div>

          {actionError && (
            <div className="mt-4 bg-white/18 px-4 py-3 text-sm font-medium text-white">
              {actionError}
            </div>
          )}

          <div className="mt-2 text-[1.05rem] leading-[1.22] text-white">
            {latestAssistantMessage}
          </div>

          <div className="mt-4 flex-1">
            {recentMessages.length > 1 && (
              <div className="max-h-[28vh] overflow-y-auto pr-1 text-[0.98rem] leading-7 text-white/82">
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
              placeholder=""
              enterKeyHint="send"
              autoFocus
              className="h-13 w-full border-none bg-white px-4 text-[1.05rem] text-[#1d1d1d] outline-none"
              disabled={isSending || isComplete}
            />
          </form>

          {isComplete && (
            <div className="mt-4 bg-white/14 px-4 py-4 text-center text-[1rem] leading-7 text-white">
              Thanks. Ember saved your contribution and updated the memory.
            </div>
          )}
        </section>
      )}

      {mode === 'voice' && (
        <section className="flex min-h-[calc(100vh-2.65rem-44vh)] flex-col border-t-2 border-white bg-[#3f8ab0] px-3 pt-4 pb-5 text-white">
          <div className="flex items-start justify-between">
            <div className="text-[1.05rem] font-semibold tracking-[-0.03em]">
              Talk with Ember
              {data.contributor.name ? ` | ${data.contributor.name}` : ''}
            </div>
            <PanelCloseButton onClick={() => setMode('askChoice')} />
          </div>

          <VoiceWaveform />

          <div className="mt-1 text-[1.02rem] leading-[1.24] text-white">
            {latestAssistantMessage}
          </div>

          <div className="mt-4 flex-1">
            {voiceTranscript && (
              <div className="bg-white/14 px-4 py-3 text-left text-sm leading-6 text-white">
                {voiceTranscript}
              </div>
            )}
            {voiceError && (
              <div className="mt-4 bg-white/14 px-4 py-3 text-left text-sm leading-6 text-white">
                {voiceError}
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-[0.18rem]">
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
            <div className="mt-4 bg-white/14 px-4 py-4 text-center text-[1rem] leading-7 text-white">
              Thanks. Ember saved your contribution and updated the memory.
            </div>
          )}
        </section>
      )}
    </main>
  );
}
