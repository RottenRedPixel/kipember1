'use client';

import { ImagePlus, Mic, Pause, Phone, Play, SendHorizontal, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import MicLevelMeter from '@/components/kipember/workflows/MicLevelMeter';
import VoiceMessageList from '@/components/kipember/workflows/VoiceMessageList';
import { useVoiceRecording } from '@/components/kipember/workflows/useVoiceRecording';
import EmberCallCard, { type EmberCallBlock } from '@/components/kipember/EmberCallCard';
import EmberChatMessages, { type EmberChatMessage } from '@/components/kipember/EmberChatMessages';

type Message = EmberChatMessage;


type EmberModalSurface = 'chats' | 'voice' | 'calls';

export default function OwnerFlow({
  emberId,
  onConversationStateChange,
  emberModalSurface = 'chats',
}: {
  emberId: string;
  onConversationStateChange?: (hasConversation: boolean) => void;
  emberModalSurface?: EmberModalSurface;
}) {
  const voice = useVoiceRecording(emberId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingWelcome, setIsLoadingWelcome] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [hasPhoneNumber, setHasPhoneNumber] = useState<boolean | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('you');
  const [isCalling, setIsCalling] = useState(false);
  const [callBlocks, setCallBlocks] = useState<EmberCallBlock[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      setIsLoadingHistory(true);
      try {
        const response = await fetch(`/api/chat?imageId=${encodeURIComponent(emberId)}`, { cache: 'no-store' });
        if (!response.ok) { if (!cancelled) { setMessages([]); onConversationStateChange?.(false); } return; }
        const payload = await response.json();
        const nextMessages = Array.isArray(payload.messages) ? (payload.messages as Message[]) : [];
        if (cancelled) return;

        if (nextMessages.length === 0) {
          // Drop out of "loading history" so the chat reveals — and flip the
          // welcome flag on so the typing indicator renders while we wait.
          if (!cancelled) {
            setIsLoadingHistory(false);
            setIsLoadingWelcome(true);
          }
          try {
            const welcomeRes = await fetch('/api/chat/welcome', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageId: emberId, situation: 'first_open' }),
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
          } finally {
            if (!cancelled) setIsLoadingWelcome(false);
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
  }, [emberId, onConversationStateChange]);


  useEffect(() => {
    let cancelled = false;
    async function loadCalls() {
      try {
        const response = await fetch(`/api/images/${encodeURIComponent(emberId)}`, { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        if (cancelled) return;
        const blocks = Array.isArray(payload?.callBlocks) ? (payload.callBlocks as EmberCallBlock[]) : [];
        setCallBlocks(blocks);
      } catch {
        /* leave empty on failure */
      }
    }
    void loadCalls();
    return () => { cancelled = true; };
  }, [emberId]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/profile', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const rawPhone = typeof data?.user?.phoneNumber === 'string' ? data.user.phoneNumber.trim() : '';
        setHasPhoneNumber(Boolean(rawPhone));
        setPhoneNumber(rawPhone);
        const fn = (data?.user?.firstName || '').trim();
        if (fn) setFirstName(fn);
      })
      .catch(() => { if (!cancelled) setHasPhoneNumber(false); });
    return () => { cancelled = true; };
  }, []);

  function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    // +1 NXX NXX XXXX
    if (digits.length === 11 && digits[0] === '1') {
      return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }
    // 10-digit US number
    if (digits.length === 10) {
      return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return raw;
  }

  async function triggerSelfInvite() {
    if (isCalling) return;
    setIsCalling(true);
    try {
      const response = await fetch(`/api/images/${encodeURIComponent(emberId)}/self-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'call' }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Could not start the call.');
      }
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
        body: JSON.stringify({ imageId: emberId, message: trimmed, inputMode }),
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
      const response = await fetch(`/api/images/${emberId}/attachments`, { method: 'POST', body: formData });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to add content.');
      const uploadedFilename: string | null = payload?.attachment?.filename ?? null;
      if (uploadedFilename) {
        const patchRes = await fetch('/api/chat', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageId: emberId, imageFilename: uploadedFilename }),
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

      {emberModalSurface === 'voice' ? (
        <div className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1 no-scrollbar">
          <VoiceMessageList messages={voice.messages} isUploading={voice.isUploading} selfLabel={firstName} />
        </div>
      ) : emberModalSurface === 'calls' ? (
        callBlocks.length === 0 ? (
          <div className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1 no-scrollbar">
            <p className="text-white/40 text-sm text-center mt-8 px-6">Tap the phone icon on the bottom to have ember call you.</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1 no-scrollbar">
            <div className="flex flex-col gap-4">
              {callBlocks.map((block) => (
                <EmberCallCard key={block.voiceCallId} block={block} hideHeader />
              ))}
            </div>
          </div>
        )
      ) : isLoadingHistory ? (
        <div className="flex-1 min-h-0" />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1 no-scrollbar">
          <EmberChatMessages
            messages={messages}
            isSending={isSending || isLoadingWelcome}
            endRef={messagesEndRef}
            selfLabel={firstName}
          />
        </div>
      )}

      {emberModalSurface === 'voice' ? (
        /* Voice toolbar — visualization pill + large green mic */
        <div className="flex items-end gap-2 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div
              className="flex h-11 w-full items-center rounded-full px-4"
              style={{
                background: (voice.isRecording || voice.isPlayingBack) ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.07)',
                border: `1px solid ${(voice.isRecording || voice.isPlayingBack) ? 'rgba(34,197,94,0.45)' : 'rgba(34,197,94,0.18)'}`,
              }}
            >
              {voice.isRecording ? (
                <MicLevelMeter stream={voice.stream} className="h-5 w-full" color="#22c55e" />
              ) : voice.isPlayingBack ? (
                <MicLevelMeter analyser={voice.playbackAnalyser} className="h-5 w-full" color="#22c55e" />
              ) : (
                <div className="h-5 w-full" />
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={voice.isRecording ? voice.stopRecording : voice.isPlayingBack ? voice.stopPlayback : voice.startRecording}
            disabled={voice.isUploading}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white transition disabled:opacity-40 cursor-pointer"
            style={{ background: (voice.isRecording || voice.isPlayingBack) ? '#16a34a' : '#22c55e' }}
            aria-label={voice.isRecording ? 'Stop recording' : voice.isPlayingBack ? 'Stop playback' : 'Record voice message'}
          >
            {voice.isRecording ? <Square size={14} fill="currentColor" /> : voice.isPlayingBack ? <Pause size={14} fill="currentColor" /> : <Mic size={18} />}
          </button>
        </div>
      ) : emberModalSurface === 'calls' ? (
        /* Calls toolbar — phone number display + phone button */
        <div className="flex items-end gap-2 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="w-full rounded-full bg-white/8 px-4 py-3 text-sm flex items-center gap-1">
              {isCalling ? (
                <>
                  <span style={{ color: '#2563eb' }}>Calling</span>
                  <span className="text-white">{formatPhone(phoneNumber)}</span>
                </>
              ) : (
                <>
                  <span className="text-white/50">The number ember will call:</span>
                  <span className="text-white">{formatPhone(phoneNumber)}</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void triggerSelfInvite()}
            disabled={isCalling}
            className="flex h-11 w-11 items-center justify-center rounded-full transition disabled:opacity-40 cursor-pointer"
            style={{ background: '#2563eb', color: 'white' }}
            aria-label="Call my phone"
          >
            <Phone size={18} />
          </button>
        </div>
      ) : (
        /* Chat toolbar */
        <form onSubmit={(e) => { e.preventDefault(); void sendMessage(input); }} className="flex items-end gap-2 flex-shrink-0">
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
      )}

      {voice.isRecording || voice.isUploading || voice.error || isUploading || error || status ? (
        <div className="px-2 pt-2 text-xs">
          {error ? <p className="text-[rgba(255,180,180,0.92)]">{error}</p>
            : voice.error ? <p className="text-[rgba(255,180,180,0.92)]">{voice.error}</p>
            : status ? <p className="text-white/48">{status}</p>
            : voice.isRecording ? <p style={{ color: 'rgba(34,197,94,0.7)' }}>Recording — tap stop when done.</p>
            : voice.isUploading ? <p className="text-white/48">Saving voice message…</p>
            : isUploading ? <p className="text-white/48">Adding to this memory...</p>
            : null}
        </div>
      ) : null}
    </div>
  );
}
