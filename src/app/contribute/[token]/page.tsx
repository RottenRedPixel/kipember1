'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { getEmberTitle } from '@/lib/ember-title';
import MediaPreview from '@/components/MediaPreview';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/contribute/${params.token}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('Invalid or expired link');
        }

        const result = await response.json();
        setData(result);

        if (result.conversation?.messages) {
          setMessages(result.conversation.messages);
          setIsComplete(result.conversation.status === 'completed');
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [params.token]);

  const refreshContributorData = useCallback(async () => {
    const response = await fetch(`/api/contribute/${params.token}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return;
    }

    const result = await response.json();
    setData(result);

    if (result.conversation?.messages) {
      setMessages(result.conversation.messages);
      setIsComplete(result.conversation.status === 'completed');
    }
  }, [params.token]);

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
      void refreshContributorData();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [data?.latestVoiceCall, refreshContributorData]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || isSending || isComplete) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsSending(true);
    setActionError('');

    try {
      const response = await fetch(`/api/contribute/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const result = await response.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: result.response }]);
      setIsComplete(result.isComplete);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const startConversation = async () => {
    setIsSending(true);
    setActionError('');

    try {
      const response = await fetch(`/api/contribute/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '__START__' }),
      });

      if (response.ok) {
        await refreshContributorData();
      }
    } catch (err) {
      console.error('Failed to start:', err);
      setActionError('Failed to start texting with Ember');
    } finally {
      setIsSending(false);
    }
  };

  const startVoiceCall = async () => {
    setIsCalling(true);
    setActionError('');

    try {
      const response = await fetch(`/api/contribute/${params.token}/call`, {
        method: 'POST',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to start voice call');
      }

      await refreshContributorData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to start voice call');
    } finally {
      setIsCalling(false);
    }
  };

  const voiceStatusLabel = (status: string) => {
    if (data?.latestVoiceCall?.memorySyncedAt) {
      return 'Your call finished and Ember added it to the memory.';
    }

    switch (status) {
      case 'registered':
        return 'Ember is dialing your phone now.';
      case 'ongoing':
        return 'Your conversation with Ember is in progress.';
      case 'ended':
        return data?.latestVoiceCall?.callSummary
          ? 'Your call with Ember finished. We will sync it shortly.'
          : 'Your last call with Ember ended.';
      case 'not_connected':
        return 'We could not connect your call with Ember.';
      case 'error':
        return 'Your call with Ember hit an error.';
      default:
        return `Speak with Ember status: ${status}`;
    }
  };

  if (isLoading) {
    return (
      <main className="ember-page flex items-center justify-center px-4">
        <div className="text-[var(--ember-muted)]">Loading...</div>
      </main>
    );
  }

  if (loadError || !data) {
    return (
      <main className="ember-page flex items-center justify-center px-4">
        <div className="ember-panel rounded-[2rem] p-8 text-center">
          <h1 className="ember-heading text-3xl text-[var(--ember-text)]">Link not found</h1>
          <p className="ember-copy mt-3 text-sm">
            {loadError || 'This link may have expired or is invalid.'}
          </p>
        </div>
      </main>
    );
  }

  const emberTitle = getEmberTitle(data.image);

  return (
    <main className="ember-page">
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <section className="ember-panel min-w-0 rounded-[2rem] p-5">
            {data.guestFlow ? (
              <Link
                href={`/guest/${params.token}`}
                className="text-sm font-medium text-[var(--ember-muted)] hover:text-[var(--ember-text)]"
              >
                {'<- Back to your memory'}
              </Link>
            ) : (
              <Link
                href={`/image/${data.image.id}`}
                className="text-sm font-medium text-[var(--ember-muted)] hover:text-[var(--ember-text)]"
              >
                {'<- Back to Ember'}
              </Link>
            )}
            <p className="ember-eyebrow">Contributor invite</p>
            <h1 className="ember-heading mt-3 break-words text-4xl text-[var(--ember-text)] [overflow-wrap:anywhere]">
              Help tell the story behind this Ember.
            </h1>
            <p className="ember-copy mt-3 text-sm">
              Add what happened before, during, or after this moment. Ember will fold your
              memories into the same living archive.
            </p>

            <div className="ember-card mt-5 overflow-hidden rounded-[1.75rem]">
              <MediaPreview
                mediaType={data.image.mediaType}
                filename={data.image.filename}
                posterFilename={data.image.posterFilename}
                originalName={emberTitle}
                controls={data.image.mediaType === 'VIDEO'}
                className="max-h-[28rem] w-full object-contain bg-[var(--ember-charcoal)]"
              />
            </div>

            <div className="mt-5 min-w-0">
              <h2
                title={emberTitle}
                className="ember-heading overflow-hidden text-ellipsis whitespace-nowrap text-lg leading-tight text-[var(--ember-text)] sm:text-2xl"
              >
                {emberTitle}
              </h2>
              {data.image.description && (
                <p className="ember-copy mt-2 text-sm">{data.image.description}</p>
              )}
            </div>
          </section>

          <section className="ember-panel min-w-0 overflow-hidden rounded-[2rem]">
            {actionError && <div className="ember-status ember-status-error m-4">{actionError}</div>}

            {data.latestVoiceCall && (
              <div className="ember-status ember-status-success m-4 mb-0">
                {voiceStatusLabel(data.latestVoiceCall.status)}
              </div>
            )}

            <div className="px-5 py-5">
              {messages.length === 0 && !isComplete ? (
                <div className="space-y-5">
                  {!data.guestFlow && (
                    <div className="ember-card rounded-[1.75rem] p-5">
                      <div className="ember-eyebrow">Start here</div>
                      <h2 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">
                        Talk Via Phone
                      </h2>
                      <p className="ember-copy mt-3 text-sm">
                        Tap the phone button and tell Ember the story out loud. Voice gives the
                        richest context and is the best way to capture what happened, how it felt,
                        and the small details that matter most.
                      </p>
                      <button
                        onClick={startVoiceCall}
                        disabled={
                          isSending ||
                          isCalling ||
                          data.latestVoiceCall?.status === 'registered' ||
                          data.latestVoiceCall?.status === 'ongoing'
                        }
                        className="ember-button-primary mt-5 w-full justify-center disabled:opacity-60"
                      >
                        {isCalling ? 'Calling...' : 'Start phone interview'}
                      </button>
                    </div>
                  )}

                  <div className="rounded-[1.5rem] border border-[var(--ember-line)] bg-white/70 px-5 py-5">
                    <div className="ember-eyebrow">Other options</div>
                    <p className="mt-3 text-sm text-[var(--ember-muted)]">
                      Prefer typing instead? You can still share the memory with Ember by text.
                    </p>
                    <button
                      onClick={startConversation}
                      disabled={isSending || isCalling}
                      className="mt-4 flex w-full items-center justify-between gap-4 rounded-[1.25rem] border border-[var(--ember-line)] bg-white px-4 py-4 text-left disabled:opacity-60"
                    >
                      <div>
                        <h3 className="text-base font-semibold text-[var(--ember-text)]">
                          Chat Via Text
                        </h3>
                        <p className="mt-1 text-sm text-[var(--ember-muted)]">
                          Best if you want to add details slowly or send a few short memories.
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-[var(--ember-orange)]">
                        {isSending ? 'Starting...' : 'Open'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="border-b ember-divider pb-4">
                    <h2 className="ember-heading text-3xl text-[var(--ember-text)]">
                      Talk with Ember
                    </h2>
                    <p className="ember-copy mt-2 text-sm">
                      Share what you remember. Ember will guide you with follow-up questions.
                    </p>
                  </div>

                  <div className="space-y-3 rounded-[1.75rem] bg-white/40 p-1">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-[1.4rem] px-4 py-3 text-sm leading-7 ${
                            message.role === 'user'
                              ? 'bg-[var(--ember-orange)] text-white'
                              : 'ember-card text-[var(--ember-text)]'
                          }`}
                        >
                          <p className="font-semibold">
                            {message.role === 'user' ? (data.contributor.name || 'You') : 'Ember'}
                          </p>
                          <p className={message.role === 'user' ? 'mt-1 text-white/90' : 'mt-1 text-[var(--ember-muted)]'}>
                            {message.content}
                          </p>
                        </div>
                      </div>
                    ))}
                    {isSending && (
                      <div className="flex justify-start">
                        <div className="ember-card rounded-[1.4rem] px-4 py-3">
                          <div className="flex gap-1">
                            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--ember-muted)]" />
                            <span
                              className="h-2 w-2 animate-bounce rounded-full bg-[var(--ember-muted)]"
                              style={{ animationDelay: '0.1s' }}
                            />
                            <span
                              className="h-2 w-2 animate-bounce rounded-full bg-[var(--ember-muted)]"
                              style={{ animationDelay: '0.2s' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {!isComplete && (
                    <form onSubmit={handleSubmit} className="mt-4 flex gap-2 border-t ember-divider pt-4">
                      <input
                        type="text"
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        placeholder="Type your response..."
                        className="ember-input flex-1"
                        disabled={isSending}
                      />
                      <button
                        type="submit"
                        disabled={isSending || !input.trim()}
                        className="ember-button-primary disabled:opacity-60"
                      >
                        Send
                      </button>
                    </form>
                  )}
                </>
              )}

              {isComplete && (
                <div className="ember-card mt-5 rounded-[1.75rem] px-5 py-6">
                  <p className="ember-eyebrow">Contribution saved</p>
                  <h3 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">Thank you.</h3>
                  <p className="ember-copy mt-2 text-sm">
                    {data.guestFlow
                      ? 'Your memory has been created from this interview. Go back to see the updated Ember.'
                      : 'Your memory is now part of this Ember. You can close this page whenever you are ready.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="ember-chip">Owner notified</span>
                    <span className="ember-chip">Story updated</span>
                    <span className="ember-chip">Memory saved</span>
                  </div>
                  <button
                    type="button"
                    onClick={startConversation}
                    disabled={isSending || isCalling}
                    className="ember-button-secondary mt-5 inline-flex px-5 disabled:opacity-60"
                  >
                    {isSending ? 'Opening...' : 'Add more by text'}
                  </button>
                  {data.guestFlow && (
                    <Link href={`/guest/${params.token}`} className="ember-button-primary mt-5 inline-flex px-5">
                      View your memory
                    </Link>
                  )}
                  {!data.guestFlow && (
                    <Link href={`/image/${data.image.id}`} className="ember-button-primary mt-5 inline-flex px-5">
                      View updated memory
                    </Link>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
