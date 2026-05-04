'use client';

// GuestFlow renders the Ember modal body for unauthenticated visitors
// arriving via a share link. It mirrors OwnerFlow / ContributorFlow's
// shape: the same outer container, the same input bar, the same surface
// switch (chats / voice — guests can't initiate calls). Differences:
//  - All API traffic goes through token-authed routes
//    (/api/contribute/[token] for chat, /api/guest/[token]/voice for voice).
//  - There's no phone-call button or photo-upload button on the input bar.
//  - No conversation-state callback because the parent shell doesn't act
//    on it for guests.

import { Mic, SendHorizontal, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import MicLevelMeter from '@/components/kipember/workflows/MicLevelMeter';
import VoiceMessageList from '@/components/kipember/workflows/VoiceMessageList';
import { useGuestVoiceRecording } from '@/components/kipember/workflows/useGuestVoiceRecording';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
};

type EmberModalSurface = 'chats' | 'voice';

export default function GuestFlow({
  token,
  emberModalSurface = 'chats',
}: {
  token: string;
  emberModalSurface?: EmberModalSurface;
}) {
  const voice = useGuestVoiceRecording(token);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          setMessages((current) =>
            current.length === 0
              ? [{ role: 'assistant', content: greeting, createdAt: new Date().toISOString() }]
              : current
          );
        }
      } catch {
        /* no-op */
      }
    }
    void loadWelcome();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || isSending) return;

    setError('');
    setInput('');
    setMessages((current) => [
      ...current,
      { role: 'user', content: trimmed, createdAt: new Date().toISOString() },
    ]);
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
        setMessages((current) => [
          ...current,
          { role: 'assistant', content: reply, createdAt: new Date().toISOString() },
        ]);
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

  return (
    <div className="flex flex-1 min-h-0 flex-col px-4 pb-4 pt-1">
      {emberModalSurface === 'voice' ? (
        <div className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1 no-scrollbar">
          <VoiceMessageList messages={voice.messages} isUploading={voice.isUploading} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1 no-scrollbar">
          <div className="flex flex-col gap-4">
            {messages.map((message, index) =>
              message.role === 'user' ? (
                <div key={index} className="flex flex-col items-end gap-1">
                  <span className="pr-1 text-xs font-bold text-white/30">you</span>
                  <div
                    className="inline-block max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5"
                    style={{ background: 'var(--bg-chat-user)' }}
                  >
                    <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={index} className="flex flex-col gap-1 items-start">
                  <span className="pl-1 text-xs font-bold text-white">ember</span>
                  <div
                    className="inline-block max-w-[90%] rounded-2xl rounded-tl-sm px-4 py-2.5"
                    style={{
                      background: 'var(--bg-ember-bubble)',
                      border: '1px solid var(--border-ember)',
                    }}
                  >
                    <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                </div>
              )
            )}

            {isSending ? (
              <div className="flex flex-col gap-1 items-start">
                <span className="pl-1 text-xs font-bold text-white">ember</span>
                <div
                  className="inline-flex max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3"
                  style={{
                    background: 'var(--bg-ember-bubble)',
                    border: '1px solid var(--border-ember)',
                  }}
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

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input bar — mirrors OwnerFlow / ContributorFlow. The mic button
          always records audio and posts to the guest voice endpoint, so
          new voice messages show up on the Voice tab regardless of which
          surface is active when the recording finishes. */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 flex-shrink-0">
        <div className="relative min-w-0 flex-1">
          {voice.isRecording ? (
            <div className="flex h-11 w-full items-center rounded-full border border-transparent bg-white/8 px-4 pr-11">
              <MicLevelMeter stream={voice.stream} className="h-5 w-full" />
            </div>
          ) : (
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                emberModalSurface === 'voice'
                  ? 'Tap the mic to record a voice note...'
                  : 'Ask Ember about this memory...'
              }
              className={`w-full rounded-full border border-transparent bg-white/8 px-4 py-3 ${emberModalSurface === 'chats' ? 'pr-11' : 'pr-11'} text-sm text-white outline-none placeholder:text-white/38 focus:border-[rgba(249,115,22,0.24)]`}
              disabled={isSending || emberModalSurface === 'voice'}
            />
          )}
          <button
            type="button"
            onClick={voice.isRecording ? voice.stopRecording : () => void voice.startRecording()}
            disabled={voice.isUploading}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-40 cursor-pointer"
            style={{
              color: voice.isRecording ? 'white' : 'rgba(255,255,255,0.5)',
              background: voice.isRecording ? 'rgba(249,115,22,0.95)' : 'transparent',
            }}
            aria-label={voice.isRecording ? 'Stop recording' : 'Record voice message'}
          >
            {voice.isRecording ? <Square size={13} fill="currentColor" /> : <Mic size={15} />}
          </button>
        </div>

        {emberModalSurface === 'chats' ? (
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white transition disabled:opacity-40 cursor-pointer"
            style={{ background: '#f97316' }}
            aria-label="Send message"
          >
            <SendHorizontal size={18} />
          </button>
        ) : null}
      </form>

      {voice.isRecording || voice.isUploading || voice.error || error ? (
        <div className="px-2 pt-2 text-xs">
          {error ? (
            <p className="text-[rgba(255,180,180,0.92)]">{error}</p>
          ) : voice.error ? (
            <p className="text-[rgba(255,180,180,0.92)]">{voice.error}</p>
          ) : voice.isRecording ? (
            <p className="text-white/48">Recording — tap the square to stop.</p>
          ) : voice.isUploading ? (
            <p className="text-white/48">Saving voice message…</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
