'use client';

import { Camera, Mic, SendHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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

      {messages.length > 0 ? (
        <div className="max-h-[34vh] overflow-y-auto pb-4 pr-1 no-scrollbar">
          <div className="flex flex-col gap-4">
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
