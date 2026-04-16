'use client';

import { Camera, MessageCircle, Mic, Phone, SendHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

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

export default function WelcomeFlow({
  imageId,
  onConversationStateChange,
}: {
  imageId: string;
  onConversationStateChange?: (hasConversation: boolean) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [inviteMode, setInviteMode] = useState<'call' | 'text' | null>(null);
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setIsLoadingHistory(true);

      try {
        const response = await fetch(`/api/chat?imageId=${encodeURIComponent(imageId)}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          if (!cancelled) {
            setMessages([]);
            onConversationStateChange?.(false);
          }
          return;
        }

        const payload = await response.json();
        const nextMessages = Array.isArray(payload.messages)
          ? (payload.messages as Message[])
          : [];

        if (!cancelled) {
          setMessages(nextMessages);
          onConversationStateChange?.(nextMessages.length > 0);
        }
      } catch {
        if (!cancelled) {
          setMessages([]);
          onConversationStateChange?.(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [imageId, onConversationStateChange]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  async function sendMessage(message: string, inputMode: 'web' | 'voice' = 'web') {
    const trimmed = message.trim();
    if (!trimmed || isSending) {
      return;
    }

    setError('');
    setStatus('');
    setInput('');
    setMessages((current) => [...current, { role: 'user', content: trimmed }]);
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId,
          message: trimmed,
          inputMode,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to send message.');
      }

      const reply =
        typeof payload?.response === 'string' && payload.response.trim().length > 0
          ? payload.response.trim()
          : 'Ember saved that to the memory.';

      setMessages((current) => [...current, { role: 'assistant', content: reply }]);
      onConversationStateChange?.(true);
    } catch (sendError) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content:
            sendError instanceof Error
              ? sendError.message
              : 'Sorry, something went wrong. Please try again.',
        },
      ]);
      onConversationStateChange?.(true);
    } finally {
      setIsSending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await sendMessage(input);
  }

  async function handleUpload(file: File) {
    if (isUploading) {
      return;
    }

    setIsUploading(true);
    setError('');
    setStatus('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/images/${imageId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to add content.');
      }

      setStatus(file.type.startsWith('video/') ? 'Video added to this memory.' : 'Photo added to this memory.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to add content.');
    } finally {
      setIsUploading(false);
    }
  }

  function startVoiceRecording() {
    setError('');
    setStatus('');

    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setError('Voice chat is not available in this browser.');
      return;
    }

    transcriptRef.current = '';

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
        transcriptRef.current = transcript.trim();
        setInput(transcriptRef.current);
      };

      recognition.onerror = (event) => {
        setError(event.error || 'Voice chat failed.');
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
        const transcript = transcriptRef.current.trim();
        transcriptRef.current = '';
        if (transcript) {
          void sendMessage(transcript, 'voice');
        }
      };

      recognitionRef.current = recognition;
      setIsRecording(true);
      recognition.start();
    } catch (voiceError) {
      setError(voiceError instanceof Error ? voiceError.message : 'Unable to start voice chat.');
      setIsRecording(false);
      recognitionRef.current = null;
    }
  }

  function stopVoiceRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  }

  function openInvite(mode: 'call' | 'text') {
    setInviteMode(mode);
    setInviteError('');
    setInviteNotice('');
  }

  function closeInvite() {
    setInviteMode(null);
    setInviteName('');
    setInvitePhone('');
    setInviteError('');
  }

  async function submitInvite() {
    if (!inviteMode || isInviting) return;

    const digits = invitePhone.replace(/\D/g, '');
    if (digits.length < 10) {
      setInviteError('Please enter a 10-digit phone number.');
      return;
    }

    setIsInviting(true);
    setInviteError('');
    setInviteNotice('');

    try {
      const createResponse = await fetch('/api/contributors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId,
          name: inviteName.trim() || null,
          phoneNumber: digits,
        }),
      });

      const createPayload = await createResponse.json().catch(() => null);

      if (!createResponse.ok) {
        throw new Error(createPayload?.error || 'Failed to add contributor.');
      }

      const contributorId: string | undefined = createPayload?.id;
      if (!contributorId) {
        throw new Error('Contributor was saved but no id was returned.');
      }

      const actionEndpoint = inviteMode === 'call' ? '/api/voice/call' : '/api/twilio/send';
      const actionResponse = await fetch(actionEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorId }),
      });

      const actionPayload = await actionResponse.json().catch(() => null);

      if (!actionResponse.ok) {
        throw new Error(
          actionPayload?.error ||
            (inviteMode === 'call'
              ? 'Contributor saved, but the call did not start.'
              : 'Contributor saved, but the invite text did not send.')
        );
      }

      const who = inviteName.trim() || formatPhoneNumber(digits);
      setInviteNotice(
        inviteMode === 'call'
          ? `Calling ${who} now — they'll hear from Ember in a moment.`
          : `Invite text sent to ${who}.`
      );
      setInviteName('');
      setInvitePhone('');
      setInviteMode(null);
    } catch (submitError) {
      setInviteError(submitError instanceof Error ? submitError.message : 'Something went wrong.');
    } finally {
      setIsInviting(false);
    }
  }

  return (
    <div className="relative z-[1] px-4 pb-4 pt-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (file) {
            void handleUpload(file);
          }
        }}
      />

      {!isLoadingHistory ? (
        <div className="max-h-[34vh] overflow-y-auto pb-4 pr-1 no-scrollbar">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 items-start">
              <span className="pl-1 text-xs font-medium text-white">ember</span>
              <div
                className="inline-block max-w-[90%] rounded-2xl rounded-tl-sm px-4 py-2.5"
                style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
              >
                <p className="text-sm leading-relaxed text-white/90">
                  Want to hear this memory from someone else? Text them an invite link, or call them now for a quick interview.
                </p>
              </div>

              {inviteMode === null ? (
                <div className="flex w-full gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openInvite('text')}
                    className="flex-1 flex items-center justify-center gap-2 rounded-full text-white text-sm font-medium btn-secondary"
                    style={{
                      border: '1.5px solid var(--border-btn)',
                      background: 'transparent',
                      minWidth: 0,
                      minHeight: 44,
                    }}
                  >
                    <MessageCircle size={16} />
                    Text someone
                  </button>
                  <button
                    type="button"
                    onClick={() => openInvite('call')}
                    className="flex-1 flex items-center justify-center gap-2 rounded-full text-white text-sm font-medium btn-primary"
                    style={{ background: '#f97316', border: 'none', minWidth: 0, minHeight: 44 }}
                  >
                    <Phone size={16} />
                    Call someone
                  </button>
                </div>
              ) : (
                <div
                  className="w-full flex flex-col gap-2 mt-1 rounded-2xl border p-3"
                  style={{
                    background: 'rgba(12,12,12,0.72)',
                    borderColor: 'rgba(255,255,255,0.08)',
                    WebkitBackdropFilter: 'blur(12px)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/80 pl-1">
                      {inviteMode === 'call' ? 'Call a contributor' : 'Text an invite'}
                    </span>
                    <button
                      type="button"
                      onClick={closeInvite}
                      aria-label="Cancel"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(event) => setInviteName(event.target.value)}
                    placeholder="Their name (optional)"
                    className="w-full rounded-full border border-transparent bg-white/8 px-4 py-3 text-sm text-white outline-none placeholder:text-white/38 focus:border-[rgba(249,115,22,0.24)]"
                    disabled={isInviting}
                  />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={formatPhoneNumber(invitePhone)}
                    onChange={(event) => setInvitePhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Phone number"
                    className="w-full rounded-full border border-transparent bg-white/8 px-4 py-3 text-sm text-white outline-none placeholder:text-white/38 focus:border-[rgba(249,115,22,0.24)]"
                    disabled={isInviting}
                  />
                  <button
                    type="button"
                    onClick={() => void submitInvite()}
                    disabled={isInviting || invitePhone.replace(/\D/g, '').length < 10}
                    className="w-full flex items-center justify-center gap-2 rounded-full text-white text-sm font-medium btn-primary disabled:opacity-40"
                    style={{ background: '#f97316', border: 'none', minHeight: 44 }}
                  >
                    {inviteMode === 'call' ? <Phone size={16} /> : <MessageCircle size={16} />}
                    {isInviting
                      ? inviteMode === 'call'
                        ? 'Starting call...'
                        : 'Sending invite...'
                      : inviteMode === 'call'
                        ? 'Start call'
                        : 'Send invite'}
                  </button>
                  {inviteError ? (
                    <p className="px-2 text-xs text-[rgba(255,180,180,0.92)]">{inviteError}</p>
                  ) : null}
                </div>
              )}

              {inviteNotice && inviteMode === null ? (
                <p className="pl-1 text-xs text-white/60">{inviteNotice}</p>
              ) : null}
            </div>

            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              return (
                <div
                  key={`${message.role}-${index}-${message.content.slice(0, 24)}`}
                  className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <span className={`text-xs font-medium ${isUser ? 'pr-1 text-white/30' : 'pl-1 text-white'}`}>
                    {isUser ? 'you' : 'ember'}
                  </span>
                  <div
                    className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'
                    }`}
                    style={{
                      background: isUser ? 'var(--bg-chat-user)' : 'var(--bg-ember-bubble)',
                      border: isUser ? 'none' : '1px solid var(--border-ember)',
                    }}
                  >
                    <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                </div>
              );
            })}
            {isSending ? (
              <div className="flex flex-col gap-1 items-start">
                <span className="pl-1 text-xs font-medium text-white">ember</span>
                <div
                  className="inline-flex max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3"
                  style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
                >
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#f97316]" />
                    <span
                      className="h-2 w-2 animate-bounce rounded-full bg-[#f97316]"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <span
                      className="h-2 w-2 animate-bounce rounded-full bg-[#f97316]"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : !isLoadingHistory ? (
        <div className="h-2" />
      ) : null}

      <div
        className="rounded-[1.45rem] border p-2"
        style={{
          background: 'rgba(12,12,12,0.72)',
          borderColor: 'rgba(255,255,255,0.08)',
          WebkitBackdropFilter: 'blur(12px)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isSending}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.08)' }}
            aria-label="Add photo"
          >
            <Camera size={18} />
          </button>

          <button
            type="button"
            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
            disabled={isSending}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition disabled:opacity-40"
            style={{ background: isRecording ? 'rgba(249,115,22,0.95)' : 'rgba(255,255,255,0.08)' }}
            aria-label={isRecording ? 'Stop voice chat' : 'Start voice chat'}
          >
            <Mic size={18} />
          </button>

          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask Ember about this memory..."
            className="min-w-0 flex-1 rounded-full border border-transparent bg-white/8 px-4 py-3 text-sm text-white outline-none placeholder:text-white/38 focus:border-[rgba(249,115,22,0.24)]"
            disabled={isSending}
          />

          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white transition disabled:opacity-40"
            style={{ background: '#f97316' }}
            aria-label="Send message"
          >
            <SendHorizontal size={18} />
          </button>
        </form>

        {isRecording || isUploading || error || status ? (
          <div className="px-2 pt-2 text-xs">
            {error ? (
              <p className="text-[rgba(255,180,180,0.92)]">{error}</p>
            ) : status ? (
              <p className="text-white/48">{status}</p>
            ) : isUploading ? (
              <p className="text-white/48">Adding to this memory...</p>
            ) : (
              <p className="text-white/48">Listening...</p>
            )}
          </div>
        ) : null}
      </div>

      <div ref={messagesEndRef} />
    </div>
  );
}
