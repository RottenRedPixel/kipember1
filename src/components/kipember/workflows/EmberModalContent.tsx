'use client';

import { ImagePlus, Mic, Phone, SendHorizontal, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import MicLevelMeter from '@/components/kipember/workflows/MicLevelMeter';
import VoiceMessageList from '@/components/kipember/workflows/VoiceMessageList';
import type { VoiceMessage } from '@/components/kipember/workflows/VoiceMessageList';
import EmberCallCard, { type EmberCallBlock } from '@/components/kipember/EmberCallCard';
import EmberChatMessages, { type EmberChatMessage } from '@/components/kipember/EmberChatMessages';
import type { EmberModalSurface } from '@/components/kipember/EmberModalShell';

// Shared voice state shape — returned by both useVoiceRecording and useGuestVoiceRecording.
export type VoiceState = {
  messages: VoiceMessage[];
  isRecording: boolean;
  isUploading: boolean;
  isPlayingBack: boolean;
  playbackAnalyser: AnalyserNode | null;
  error: string;
  stream: MediaStream | null;
  startRecording: () => void | Promise<void>;
  stopRecording: () => void;
};

// All API calls are passed in as async functions so the component never
// knows whether it's talking to a cookie-authed or token-authed endpoint.
export type EmberFlowApi = {
  // Chat — always required
  sendChat: (text: string, inputMode?: 'web' | 'voice') => Promise<string | null>;
  // Optional — guests have no persistent history
  loadHistory?: () => Promise<EmberChatMessage[]>;
  // Optional — if provided, called when history is empty
  loadWelcome?: () => Promise<string | null>;
  // Optional — only available to authenticated users and NPW contributors
  uploadPhoto?: (file: File) => Promise<{ filename: string; reply: string | null }>;
  // Optional — only available when canCall is true
  loadCallProfile?: () => Promise<{ phoneNumber: string; firstName: string }>;
  loadCallBlocks?: () => Promise<EmberCallBlock[]>;
  triggerCall?: () => Promise<void>;
};

export default function EmberModalContent({
  api,
  voice,
  emberModalSurface = 'chats',
  onConversationStateChange,
  chatPlaceholder = 'Chat with ember...',
  canUploadPhoto = false,
  canCall = false,
}: {
  api: EmberFlowApi;
  voice: VoiceState;
  emberModalSurface?: EmberModalSurface;
  onConversationStateChange?: (hasConversation: boolean) => void;
  chatPlaceholder?: string;
  canUploadPhoto?: boolean;
  canCall?: boolean;
}) {
  const [messages, setMessages] = useState<EmberChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(Boolean(api.loadHistory));
  const [isLoadingWelcome, setIsLoadingWelcome] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [manualAnalyser, setManualAnalyser] = useState<AnalyserNode | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selfLabel, setSelfLabel] = useState('you');
  const [isCalling, setIsCalling] = useState(false);
  const [callBlocks, setCallBlocks] = useState<EmberCallBlock[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // Capture api on mount — component is re-keyed by parent when identity changes.
  const apiRef = useRef(api);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history + welcome message (runs once on mount).
  useEffect(() => {
    const { loadHistory, loadWelcome } = apiRef.current;
    if (!loadHistory) {
      setIsLoadingHistory(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setIsLoadingHistory(true);
      try {
        const history = await loadHistory!();
        if (cancelled) return;
        if (history.length === 0 && loadWelcome) {
          setIsLoadingHistory(false);
          setIsLoadingWelcome(true);
          try {
            const welcome = await loadWelcome();
            if (!cancelled && welcome) {
              setMessages([{ role: 'assistant', content: welcome, createdAt: new Date().toISOString() }]);
              onConversationStateChange?.(true);
              return;
            }
          } catch { /* fall through to empty state */ } finally {
            if (!cancelled) setIsLoadingWelcome(false);
          }
          setMessages([]);
          onConversationStateChange?.(false);
          return;
        }
        setMessages(history);
        onConversationStateChange?.(history.length > 0);
      } catch {
        if (!cancelled) { setMessages([]); onConversationStateChange?.(false); }
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load call profile (phone number + display name) once on mount.
  useEffect(() => {
    const { loadCallProfile } = apiRef.current;
    if (!loadCallProfile) return;
    let cancelled = false;
    loadCallProfile().then(({ phoneNumber: phone, firstName }) => {
      if (cancelled) return;
      if (phone) setPhoneNumber(phone);
      if (firstName) setSelfLabel(firstName);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load call history blocks once on mount.
  useEffect(() => {
    const { loadCallBlocks } = apiRef.current;
    if (!loadCallBlocks) return;
    let cancelled = false;
    loadCallBlocks().then((blocks) => {
      if (!cancelled) setCallBlocks(blocks);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 11 && digits[0] === '1') return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    if (digits.length === 10) return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    return raw;
  }

  async function sendMessage(text: string, inputMode: 'web' | 'voice' = 'web') {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setError(''); setStatus(''); setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setIsSending(true);
    try {
      const reply = await apiRef.current.sendChat(trimmed, inputMode);
      if (reply) setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      onConversationStateChange?.(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSending(false);
    }
  }

  async function handleUpload(file: File) {
    const { uploadPhoto } = apiRef.current;
    if (!uploadPhoto || isUploading) return;
    setIsUploading(true); setError(''); setStatus('');
    const isVideo = file.type.startsWith('video/');
    const previewUrl = URL.createObjectURL(file);
    setMessages((prev) => [...prev, { role: 'user', content: isVideo ? 'Video' : 'Photo', imageUrl: previewUrl }]);
    try {
      const { filename, reply } = await uploadPhoto(file);
      setMessages((prev) => [
        ...prev.map((m) => m.imageUrl === previewUrl ? { ...m, imageUrl: undefined, imageFilename: filename } : m),
        ...(reply ? [{ role: 'assistant' as const, content: reply }] : []),
      ]);
      onConversationStateChange?.(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add content.');
    } finally {
      URL.revokeObjectURL(previewUrl);
      setIsUploading(false);
    }
  }

  async function triggerCall() {
    const { triggerCall: doCall } = apiRef.current;
    if (!doCall || isCalling) return;
    setIsCalling(true);
    try {
      await doCall();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsCalling(false);
    }
  }

  return (
    <div className="relative z-[1] flex flex-col flex-1 min-h-0 px-4 pb-4 pt-1">
      {canUploadPhoto && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.currentTarget.value = '';
            if (file) void handleUpload(file);
          }}
        />
      )}

      {/* ── Content area ── */}
      {emberModalSurface === 'voice' ? (
        <div className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1 no-scrollbar">
          <VoiceMessageList messages={voice.messages} isUploading={voice.isUploading} selfLabel={selfLabel} onPlaybackChange={setManualAnalyser} />
        </div>
      ) : emberModalSurface === 'calls' && canCall ? (
        callBlocks.length === 0 ? (
          <div className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1 no-scrollbar">
            <p className="text-white/40 text-sm text-center mt-8 px-6">Tap the phone to have ember call you.</p>
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
            selfLabel={selfLabel}
          />
        </div>
      )}

      {/* ── Toolbar ── */}
      {emberModalSurface === 'voice' ? (
        <div className="flex items-end gap-2 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div
              className="flex h-11 w-full items-center rounded-full px-4"
              style={{
                background: (voice.isRecording || voice.isPlayingBack || !!manualAnalyser) ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${(voice.isRecording || voice.isPlayingBack || !!manualAnalyser) ? 'rgba(34,197,94,0.45)' : 'transparent'}`,
              }}
            >
              {voice.isRecording ? (
                <MicLevelMeter stream={voice.stream} className="h-5 w-full" color="#22c55e" />
              ) : (voice.playbackAnalyser ?? manualAnalyser) ? (
                <MicLevelMeter analyser={voice.playbackAnalyser ?? manualAnalyser} className="h-5 w-full" color="#22c55e" />
              ) : (
                <span className="text-sm w-full text-white/38">Talk with ember...</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={voice.isRecording ? voice.stopRecording : () => void voice.startRecording()}
            disabled={voice.isUploading}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white transition disabled:opacity-40 cursor-pointer"
            style={{ background: voice.isRecording ? '#16a34a' : '#22c55e' }}
            aria-label={voice.isRecording ? 'Stop recording' : 'Record voice message'}
          >
            {voice.isRecording ? <Square size={14} fill="currentColor" /> : <Mic size={18} />}
          </button>
        </div>
      ) : emberModalSurface === 'calls' && canCall ? (
        <div className="flex items-end gap-2 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div
              className="flex h-11 w-full items-center rounded-full px-4 gap-1.5 text-sm"
              style={{
                background: isCalling ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${isCalling ? 'rgba(37,99,235,0.45)' : 'transparent'}`,
              }}
            >
              {isCalling ? (
                <><span style={{ color: 'rgba(96,165,250,0.9)' }}>Calling</span><span className="text-white">{formatPhone(phoneNumber)}</span></>
              ) : (
                <><span className="text-white/50">Ember will call:</span><span className="text-white">{formatPhone(phoneNumber)}</span></>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void triggerCall()}
            disabled={isCalling || !phoneNumber}
            className="flex h-11 w-11 items-center justify-center rounded-full transition disabled:opacity-40 cursor-pointer"
            style={{ background: '#2563eb', color: 'white' }}
            aria-label="Call my phone"
          >
            <Phone size={18} />
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void sendMessage(input); }} className="flex items-end gap-2 flex-shrink-0">
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={chatPlaceholder}
              className="w-full rounded-full border border-transparent bg-white/8 px-4 py-3 text-sm text-white outline-none placeholder:text-white/38 focus:border-[rgba(249,115,22,0.24)]"
              style={{ paddingRight: canUploadPhoto ? '2.75rem' : '1rem' }}
              disabled={isSending}
            />
            {canUploadPhoto && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isSending}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition disabled:opacity-40 cursor-pointer"
                aria-label="Add photo"
              >
                <ImagePlus size={15} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isSending}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white transition disabled:opacity-40 cursor-pointer"
            style={{ background: '#f97316' }}
            aria-label="Send message"
          >
            <SendHorizontal size={18} />
          </button>
        </form>
      )}

      {/* ── Status line ── */}
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
