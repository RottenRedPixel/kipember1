'use client';

import { ImagePlus, Mic, Pause, Phone, Play, SendHorizontal, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import CallsPlaceholderList from '@/components/kipember/workflows/CallsPlaceholderList';
import VoiceMessageList from '@/components/kipember/workflows/VoiceMessageList';
import { useVoiceRecording } from '@/components/kipember/workflows/useVoiceRecording';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  source?: 'web' | 'voice';
  imageUrl?: string;
  imageFilename?: string | null;
  audioUrl?: string | null;
  createdAt?: string;
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

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); } else { void audio.play(); }
  }

  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      <button
        type="button"
        onClick={toggle}
        className="flex h-6 w-6 items-center justify-center rounded-full cursor-pointer flex-shrink-0"
        style={{ background: 'rgba(249,115,22,0.85)' }}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause size={11} className="text-white" /> : <Play size={11} className="text-white" />}
      </button>
      <span className="text-white/40 text-xs">Voice recording</span>
    </div>
  );
}

export default function OwnerFlow({
  imageId,
  onConversationStateChange,
  chatTab = 'chats',
}: {
  imageId: string;
  onConversationStateChange?: (hasConversation: boolean) => void;
  chatTab?: 'chats' | 'voice' | 'calls';
}) {
  const voice = useVoiceRecording(imageId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [hasPhoneNumber, setHasPhoneNumber] = useState<boolean | null>(null);
  const [isCalling, setIsCalling] = useState(false);
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
        const response = await fetch(`/api/chat?imageId=${encodeURIComponent(imageId)}`, { cache: 'no-store' });
        if (!response.ok) { if (!cancelled) { setMessages([]); onConversationStateChange?.(false); } return; }
        const payload = await response.json();
        const nextMessages = Array.isArray(payload.messages) ? (payload.messages as Message[]) : [];
        if (cancelled) return;

        if (nextMessages.length === 0) {
          try {
            const welcomeRes = await fetch('/api/chat/welcome', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageId, situation: 'first_open' }),
            });
            if (welcomeRes.ok) {
              const { message } = await welcomeRes.json();
              if (!cancelled && typeof message === 'string' && message.trim()) {
                setMessages([{ role: 'assistant', content: message, createdAt: new Date().toISOString() }]);
                onConversationStateChange?.(true);
                return;
              }
            }
          } catch {
            /* fall through to empty state */
          }
          setMessages([]);
          onConversationStateChange?.(false);
          return;
        }

        setMessages(nextMessages);
        onConversationStateChange?.(true);
      } catch {
        if (!cancelled) { setMessages([]); onConversationStateChange?.(false); }
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    }
    void loadHistory();
    return () => { cancelled = true; };
  }, [imageId, onConversationStateChange]);

  useEffect(() => {
    return () => { if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; } };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/profile', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setHasPhoneNumber(Boolean(data?.user?.phoneNumber)); })
      .catch(() => { if (!cancelled) setHasPhoneNumber(false); });
    return () => { cancelled = true; };
  }, []);

  async function triggerSelfInvite() {
    if (isCalling || hasPhoneNumber === false || hasPhoneNumber === null) return;
    setIsCalling(true);
    try {
      const response = await fetch(`/api/images/${encodeURIComponent(imageId)}/self-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'call' }),
      });
      if (!response.ok) throw new Error('Could not start the call.');
      setStatus('Calling you now — Ember will dial your phone in a moment.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsCalling(false);
    }
  }

  async function sendMessage(message: string, inputMode: 'web' | 'voice' = 'web') {
    const trimmed = message.trim();
    if (!trimmed || isSending) return;
    setError(''); setStatus(''); setInput('');
    setMessages((current) => [...current, { role: 'user', content: trimmed }]);
    setIsSending(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, message: trimmed, inputMode }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to send message.');
      const reply = typeof payload?.response === 'string' ? payload.response.trim() : '';
      if (reply) {
        setMessages((current) => [...current, { role: 'assistant', content: reply }]);
      }
      onConversationStateChange?.(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Something went wrong.');
    } finally {
      setIsSending(false);
    }
  }

  async function handleUpload(file: File) {
    if (isUploading) return;
    setIsUploading(true); setError(''); setStatus('');
    const isVideo = file.type.startsWith('video/');
    const previewUrl = URL.createObjectURL(file);
    setMessages((prev) => [...prev, { role: 'user', content: isVideo ? 'Video' : 'Photo', imageUrl: previewUrl }]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/images/${imageId}/attachments`, { method: 'POST', body: formData });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to add content.');
      const uploadedFilename: string | null = payload?.attachment?.filename ?? null;
      if (uploadedFilename) {
        const patchRes = await fetch('/api/chat', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageId, imageFilename: uploadedFilename }),
        });
        const patchPayload = await patchRes.json().catch(() => null);
        const reply = typeof patchPayload?.response === 'string' ? patchPayload.response.trim() : '';
        setMessages((prev) => [
          ...prev.map((m) => m.imageUrl === previewUrl ? { ...m, imageUrl: undefined, imageFilename: uploadedFilename } : m),
          ...(reply ? [{ role: 'assistant' as const, content: reply }] : []),
        ]);
        onConversationStateChange?.(true);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to add content.');
    } finally {
      URL.revokeObjectURL(previewUrl);
      setIsUploading(false);
    }
  }

  function startVoiceRecording() {
    setError(''); setStatus('');
    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionCtor) { setError('Voice chat is not available in this browser.'); return; }
    transcriptRef.current = '';
    try {
      if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
      const recognition = new RecognitionCtor();
      recognition.lang = 'en-US'; recognition.continuous = false; recognition.interimResults = true;
      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i += 1) transcript += event.results[i][0]?.transcript || '';
        transcriptRef.current = transcript.trim(); setInput(transcriptRef.current);
      };
      recognition.onerror = (event) => { setError(event.error || 'Voice chat failed.'); setIsRecording(false); recognitionRef.current = null; };
      recognition.onend = () => {
        setIsRecording(false); recognitionRef.current = null;
        const transcript = transcriptRef.current.trim(); transcriptRef.current = '';
        if (transcript) void sendMessage(transcript, 'voice');
      };
      recognitionRef.current = recognition; setIsRecording(true); recognition.start();
    } catch (voiceError) {
      setError(voiceError instanceof Error ? voiceError.message : 'Unable to start voice chat.'); setIsRecording(false); recognitionRef.current = null;
    }
  }

  function stopVoiceRecording() {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsRecording(false);
  }

  return (
    <div className="relative z-[1] flex flex-col flex-1 min-h-0 px-4 pb-4 pt-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (file) void handleUpload(file);
        }}
      />

      {chatTab === 'voice' ? (
        <div className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1 no-scrollbar">
          <VoiceMessageList messages={voice.messages} isUploading={voice.isUploading} />
        </div>
      ) : chatTab === 'calls' ? (
        <div className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1 no-scrollbar">
          <CallsPlaceholderList />
        </div>
      ) : isLoadingHistory ? (
        <div className="flex-1 min-h-0" />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1 no-scrollbar">
          <div className="flex flex-col gap-4">
            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              const isVoice = message.source === 'voice';
              const msgDate = message.createdAt ? new Date(message.createdAt) : null;
              const prevDate = index > 0 && messages[index - 1]?.createdAt ? new Date(messages[index - 1].createdAt!) : null;
              const showDateDivider = msgDate && (!prevDate || msgDate.toDateString() !== prevDate.toDateString());
              const timeLabel = msgDate && !Number.isNaN(msgDate.getTime()) ? msgDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
              const dateDividerLabel = msgDate && !Number.isNaN(msgDate.getTime()) ? msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
              return (
                <div key={`${message.role}-${index}-${message.content.slice(0, 24)}`}>
                  {showDateDivider && dateDividerLabel ? (
                    <div className="flex justify-center my-2"><span className="text-white/25 text-[10px]">{dateDividerLabel}</span></div>
                  ) : null}
                  <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                    <span className={`flex items-center gap-1 text-xs font-bold ${isUser ? 'pr-1 text-white/30' : 'pl-1 text-white'}`}>
                      {isVoice ? <Phone size={10} className={isUser ? 'text-white/30' : 'text-white/60'} /> : null}
                      {isUser ? 'you' : 'ember'}
                    </span>
                    {(message.imageUrl || message.imageFilename) ? (
                      <div className="max-w-[30%] rounded-2xl rounded-tr-sm overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={message.imageUrl ?? `/api/uploads/${message.imageFilename}`} alt="Uploaded photo" className="w-full h-auto object-cover" />
                      </div>
                    ) : (
                      <div className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`} style={{ background: isUser ? 'var(--bg-chat-user)' : 'var(--bg-ember-bubble)', border: isUser ? 'none' : '1px solid var(--border-ember)' }}>
                        <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">{message.content}</p>
                        {message.audioUrl ? <AudioPlayer src={message.audioUrl} /> : null}
                      </div>
                    )}
                    {timeLabel ? <span className={`text-white/25 text-[10px] mt-0.5 ${isUser ? 'pr-1' : 'pl-1'}`}>{timeLabel}</span> : null}
                  </div>
                </div>
              );
            })}

            {isSending ? (
              <div className="flex flex-col gap-1 items-start">
                <span className="pl-1 text-xs font-bold text-white">ember</span>
                <div className="inline-flex max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}>
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
      )}

      <form onSubmit={(e) => { e.preventDefault(); void sendMessage(input); }} className="flex items-end gap-2 flex-shrink-0">
        <button type="button" onClick={() => void triggerSelfInvite()} disabled={isCalling || hasPhoneNumber === false} className="flex h-11 w-11 items-center justify-center rounded-full transition disabled:opacity-40 cursor-pointer" style={{ background: isCalling ? 'rgba(249,115,22,0.95)' : 'rgba(255,255,255,0.08)', color: '#f97316' }} aria-label="Call my phone">
          <Phone size={18} />
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isSending} className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition disabled:opacity-40" style={{ background: 'rgba(255,255,255,0.08)' }} aria-label="Add photo">
          <ImagePlus size={18} />
        </button>
        <div className="relative min-w-0 flex-1">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Chat with ember..." className="w-full rounded-full border border-transparent bg-white/8 px-4 py-3 pr-11 text-sm text-white outline-none placeholder:text-white/38 focus:border-[rgba(249,115,22,0.24)]" disabled={isSending} />
          <button
            type="button"
            onClick={voice.isRecording ? voice.stopRecording : voice.startRecording}
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
        <button type="submit" disabled={isSending || !input.trim()} className="flex h-11 w-11 items-center justify-center rounded-full text-white transition disabled:opacity-40 cursor-pointer" style={{ background: '#f97316' }} aria-label="Send message">
          <SendHorizontal size={18} />
        </button>
      </form>

      {voice.isRecording || voice.isUploading || voice.error || isUploading || error || status ? (
        <div className="px-2 pt-2 text-xs">
          {error ? <p className="text-[rgba(255,180,180,0.92)]">{error}</p>
            : voice.error ? <p className="text-[rgba(255,180,180,0.92)]">{voice.error}</p>
            : status ? <p className="text-white/48">{status}</p>
            : voice.isRecording ? <p className="text-white/48">Recording — tap the square to stop.</p>
            : voice.isUploading ? <p className="text-white/48">Saving voice message…</p>
            : isUploading ? <p className="text-white/48">Adding to this memory...</p>
            : null}
        </div>
      ) : null}
    </div>
  );
}
