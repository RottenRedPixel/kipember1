'use client';

import { Mic, SendHorizontal } from 'lucide-react';
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
  results: ArrayLike<{ isFinal?: boolean; 0: { transcript: string } }>;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

export default function GuestFlow({ token }: { token: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadWelcome() {
      try {
        const response = await fetch(`/api/contribute/${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: '__START__' }),
        });
        if (!response.ok) return;
        const payload = await response.json().catch(() => null);
        const greeting = typeof payload?.response === 'string' ? payload.response.trim() : '';
        if (!cancelled && greeting) {
          setMessages((current) => (current.length === 0 ? [{ role: 'assistant', content: greeting }] : current));
        }
      } catch {
        /* no-op */
      }
    }
    void loadWelcome();
    return () => { cancelled = true; };
  }, [token]);

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || isSending) return;

    setError('');
    setInput('');
    setMessages((current) => [...current, { role: 'user', content: trimmed }]);
    setIsSending(true);

    try {
      const response = await fetch(`/api/contribute/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to send message.');

      const reply = typeof payload?.response === 'string' ? payload.response.trim() : '';
      if (reply) {
        setMessages((current) => [...current, { role: 'assistant', content: reply }]);
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Something went wrong.');
    } finally {
      setIsSending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await sendMessage(input);
  }

  function startVoiceRecording() {
    setError('');

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
          void sendMessage(transcript);
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
      <div className="max-h-[34vh] overflow-y-auto pb-4 pr-1 no-scrollbar">
        <div className="flex flex-col gap-4">
          {/* Conversation messages (greeting comes from the unified Ember reply) */}
          {messages.map((message, index) =>
            message.role === 'user' ? (
              <div key={index} className="flex flex-col items-end gap-1">
                <span className="pr-1 text-xs font-bold text-white/30">you</span>
                <div
                  className="inline-block max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5"
                  style={{ background: 'var(--bg-chat-user)' }}
                >
                  <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ) : (
              <div key={index} className="flex flex-col gap-1 items-start">
                <span className="pl-1 text-xs font-bold text-white">ember</span>
                <div
                  className="inline-block max-w-[90%] rounded-2xl rounded-tl-sm px-4 py-2.5"
                  style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
                >
                  <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            )
          )}

          {/* Sending indicator */}
          {isSending ? (
            <div className="flex flex-col gap-1 items-start">
              <span className="pl-1 text-xs font-bold text-white">ember</span>
              <div
                className="inline-flex max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3"
                style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
              >
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[#f97316]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[#f97316]" style={{ animationDelay: '0.1s' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[#f97316]" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <button
          type="button"
          onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
          disabled={isSending}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition disabled:opacity-40 cursor-pointer"
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
          className="flex h-11 w-11 items-center justify-center rounded-full text-white transition disabled:opacity-40 cursor-pointer"
          style={{ background: '#f97316' }}
          aria-label="Send message"
        >
          <SendHorizontal size={18} />
        </button>
      </form>

      {isRecording || error ? (
        <div className="px-2 pt-2 text-xs">
          {error ? (
            <p className="text-[rgba(255,180,180,0.92)]">{error}</p>
          ) : (
            <p className="text-white/48">Listening...</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
