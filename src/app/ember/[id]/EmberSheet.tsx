'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ImagePlus, MessageCircle, MessageCirclePlus, MessageSquare, Mic, Phone, SendHorizontal, Square, X } from 'lucide-react';
import MicLevelMeter from '@/components/kipember/workflows/MicLevelMeter';
import VoiceMessageList from '@/components/kipember/workflows/VoiceMessageList';
import { useVoiceRecording } from '@/components/kipember/workflows/useVoiceRecording';
import EmberCallCard, { type EmberCallBlock } from '@/components/kipember/EmberCallCard';
import EmberChatMessages, { type EmberChatMessage } from '@/components/kipember/EmberChatMessages';
import { EmberMark } from '@/components/kipember/EmberModalShell';
import type { EmberModalSurface } from '@/components/kipember/EmberModalShell';
import { useToast } from '@/lib/toast';
import { useResetZoomOnOpen } from '@/lib/reset-zoom';

const SNAP_MS = 320;

const TABS: { label: string; surface: EmberModalSurface; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { label: 'chat',  surface: 'chats', icon: MessageCircle },
  { label: 'voice', surface: 'voice', icon: Mic },
  { label: 'call',  surface: 'calls', icon: Phone },
  { label: 'sms',   surface: 'sms',   icon: MessageSquare },
];

const SURFACE_LABEL: Record<EmberModalSurface, string> = {
  chats: 'chat with ember',
  voice: 'voice messages',
  calls: 'ember will call you',
  sms:   'text with ember',
};

export default function EmberSheet({
  isOpen,
  onClose,
  emberId,
  onAction,
}: {
  isOpen: boolean;
  onClose: () => void;
  emberId: string | null;
  onAction?: (action: { type: string; target: string; label: string }) => void;
}) {
  const [showing, setShowing] = useState(isOpen);
  const [expanded, setExpanded] = useState(false);
  const [surface, setSurface] = useState<EmberModalSurface>('chats');

  // Chat state
  const [messages, setMessages] = useState<EmberChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingWelcome, setIsLoadingWelcome] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Calls state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selfLabel, setSelfLabel] = useState('you');
  const [isCalling, setIsCalling] = useState(false);
  const [callBlocks, setCallBlocks] = useState<EmberCallBlock[]>([]);
  const [manualAnalyser, setManualAnalyser] = useState<AnalyserNode | null>(null);

  const [chatFocused, setChatFocused] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadedRef = useRef(false);

  const voice = useVoiceRecording(emberId ?? '');
  const { toast } = useToast();
  useResetZoomOnOpen(isOpen);

  // Scroll to latest message
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Scroll to bottom on surface switch and on open
  useEffect(() => {
    if (!isOpen) return;
    const el = contentRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [surface, isOpen]);

  // Voice state toasts
  const prevRecording = useRef(false);
  const prevVoiceUploading = useRef(false);
  useEffect(() => {
    if (voice.isRecording && !prevRecording.current) toast('Recording — tap stop when done.', { duration: 8000 });
    prevRecording.current = voice.isRecording;
  }, [voice.isRecording]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (voice.isUploading && !prevVoiceUploading.current) toast('Saving voice message…');
    prevVoiceUploading.current = voice.isUploading;
  }, [voice.isUploading]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (voice.error) toast(voice.error, { type: 'error' });
  }, [voice.error]); // eslint-disable-line react-hooks/exhaustive-deps


  // Load chat history + call data once when sheet opens with a valid ember
  useEffect(() => {
    if (!isOpen || !emberId || loadedRef.current) return;
    loadedRef.current = true;

    setIsLoadingHistory(true);
    fetch(`/api/chat?emberId=${encodeURIComponent(emberId)}`)
      .then((r) => r.json())
      .then((d) => {
        const hist: EmberChatMessage[] = Array.isArray(d?.messages) ? d.messages : [];
        if (hist.length === 0) {
          setIsLoadingHistory(false);
          setIsLoadingWelcome(true);
          fetch('/api/chat/welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emberId, situation: 'first_open' }),
          })
            .then((r) => r.json())
            .then((wd) => { const msg = wd?.message ?? wd?.reply ?? wd?.response; if (msg) setMessages([{ role: 'assistant', content: msg, createdAt: new Date().toISOString() }]); })
            .catch(() => {})
            .finally(() => setIsLoadingWelcome(false));
        } else {
          setMessages(hist);
          setIsLoadingHistory(false);
        }
      })
      .catch(() => { setIsLoadingHistory(false); });

    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => {
        if (d?.user?.phoneNumber) setPhoneNumber(d.user.phoneNumber);
        if (d?.user?.firstName) setSelfLabel((d.user.firstName as string).trim() || 'you');
      })
      .catch(() => {});

    fetch(`/api/embers/${encodeURIComponent(emberId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.callBlocks)) setCallBlocks(d.callBlocks); })
      .catch(() => {});
  }, [isOpen, emberId]);

  // Reset on close
  useEffect(() => {
    if (isOpen) { setShowing(true); }
    else {
      setShowing(false);
      setExpanded(false);
      loadedRef.current = false;
      setMessages([]);
      setInput('');
      setIsLoadingHistory(false);
      setIsLoadingWelcome(false);
    }
  }, [isOpen]);

  const sendChat = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending || !emberId) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed, createdAt: new Date().toISOString() }]);
    setIsSending(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emberId, message: trimmed, inputMode: 'web' }),
      });
      const d = await r.json();
      const reply = d?.reply ?? d?.response;
      const actions = Array.isArray(d?.actions) ? d.actions : undefined;
      if (reply) setMessages((prev) => [...prev, { role: 'assistant', content: reply, createdAt: new Date().toISOString(), actions }]);
    } catch { toast('Something went wrong.', { type: 'error' }); }
    finally { setIsSending(false); }
  }, [input, isSending, emberId, toast]);

  const uploadPhoto = useCallback(async (file: File) => {
    if (!emberId || isUploading) return;
    setIsUploading(true);
    toast('Adding to this memory…', { duration: 8000 });
    const isVideo = file.type.startsWith('video/');
    const previewUrl = URL.createObjectURL(file);
    setMessages((prev) => [...prev, { role: 'user', content: isVideo ? 'Video' : 'Photo', imageUrl: previewUrl }]);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch(`/api/embers/${encodeURIComponent(emberId)}/attachments`, { method: 'POST', body: form });
      const payload = await r.json().catch(() => null);
      if (!r.ok) throw new Error(payload?.error ?? 'Failed to add content.');
      const imageFilename: string | null = payload?.attachment?.filename ?? null;
      if (!imageFilename) throw new Error('Upload succeeded but no filename returned.');
      const chat = await fetch('/api/chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emberId, imageFilename }),
      });
      const chatData = await chat.json().catch(() => null);
      setMessages((prev) => [
        ...prev.map((m) => m.imageUrl === previewUrl ? { ...m, imageUrl: undefined, imageFilename } : m),
        ...((chatData?.reply ?? chatData?.response) ? [{ role: 'assistant' as const, content: chatData.reply ?? chatData.response }] : []),
      ]);
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed to add content.', { type: 'error' }); }
    finally { URL.revokeObjectURL(previewUrl); setIsUploading(false); }
  }, [emberId, isUploading, toast]);

  const triggerCall = useCallback(async () => {
    if (!emberId || isCalling) return;
    setIsCalling(true);
    try {
      const r = await fetch(`/api/embers/${encodeURIComponent(emberId)}/self-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'call' }),
      });
      if (r.ok) toast('Calling you now!', { type: 'success', duration: 5000 });
      else toast('Could not place the call. Try again.', { type: 'error' });
    }
    catch { toast('Something went wrong.', { type: 'error' }); }
    finally { setIsCalling(false); }
  }, [emberId, isCalling, toast]);

  function formatPhone(raw: string) {
    const d = raw.replace(/\D/g, '');
    if (d.length === 11 && d[0] === '1') return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
    if (d.length === 10) return `+1 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
    return raw;
  }

  function handleClose() { setShowing(false); setExpanded(false); setTimeout(onClose, SNAP_MS); }

  // ── Toolbar pill content ────────────────────────────────────────────────────
  const isVoiceActive = voice.isRecording || voice.isPlayingBack || !!manualAnalyser;

  function PillContent() {
    if (surface === 'voice') {
      return voice.isRecording ? (
        <MicLevelMeter stream={voice.stream} className="h-5 w-full" color="var(--bubble-voice-accent)" />
      ) : (voice.playbackAnalyser ?? manualAnalyser) ? (
        <MicLevelMeter analyser={voice.playbackAnalyser ?? manualAnalyser} className="h-5 w-full" color="var(--bubble-voice-accent)" />
      ) : (
        <span className="text-sm w-full" style={{ color: 'rgba(255,255,255,0.38)' }}>Talk with ember...</span>
      );
    }
    if (surface === 'calls') {
      return (
        <><span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>ember will call:</span><span className="text-white text-sm ml-1.5">{formatPhone(phoneNumber)}</span></>
      );
    }
    if (surface === 'sms') {
      return (
        <><span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>ember will SMS:</span><span className="text-white text-sm ml-1.5">{formatPhone(phoneNumber)}</span></>
      );
    }
    // chats
    return (
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void sendChat(); } }}
        placeholder="Chat with ember..."
        className="flex-1 bg-transparent text-sm text-white outline-none min-w-0"
        style={{ caretColor: 'var(--bubble-chat-accent)' }}
        disabled={isSending}
        onFocus={() => setChatFocused(true)}
        onBlur={() => setChatFocused(false)}
      />
    );
  }

  function ActionButton() {
    if (surface === 'voice') {
      return (
        <button
          type="button"
          onClick={voice.isRecording ? voice.stopRecording : () => void voice.startRecording()}
          disabled={voice.isUploading}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-white cursor-pointer disabled:opacity-40"
          style={{ background: 'var(--bubble-voice-accent)', filter: voice.isRecording ? 'brightness(0.8)' : undefined }}
          aria-label={voice.isRecording ? 'Stop' : 'Record'}
        >
          {voice.isRecording ? <Square size={14} fill="currentColor" /> : <Mic size={18} />}
        </button>
      );
    }
    if (surface === 'calls') {
      return (
        <button
          type="button"
          onClick={() => void triggerCall()}
          disabled={isCalling || !phoneNumber}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-white cursor-pointer disabled:opacity-40"
          style={{ background: 'var(--bubble-call-accent)' }}
          aria-label="Call"
        >
          <Phone size={18} />
        </button>
      );
    }
    if (surface === 'sms') {
      return (
        <button
          type="button"
          disabled
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-white cursor-pointer disabled:opacity-40"
          style={{ background: 'var(--bubble-sms-accent)' }}
          aria-label="Send SMS"
        >
          <SendHorizontal size={18} />
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => void sendChat()}
        disabled={isSending}
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-white cursor-pointer disabled:opacity-40"
        style={{ background: 'var(--bubble-chat-accent)' }}
        aria-label="Send"
      >
        <SendHorizontal size={18} />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex flex-col"
      style={{
        height: expanded ? '100dvh' : '50vh',
        zIndex: expanded ? 50 : 10,
        background: 'var(--bg-sheets)',
        borderTop: expanded ? 'none' : '1px solid var(--border-subtle)',
        borderRadius: expanded ? 0 : '20px 20px 0 0',
        transform: showing ? 'translateY(0)' : 'translateY(100%)',
        transition: `transform ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1), height ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      {/* Header */}
      <div className="flex items-center px-4 pt-4 pb-3 gap-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-header)' }}>
        <MessageCirclePlus size={18} color="white" strokeWidth={1.8} className="flex-shrink-0" />
        <span className="font-semibold text-base flex-shrink-0 text-white">ember</span>
        <div className="flex items-center gap-0.5 rounded-xl p-1 mx-auto" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {TABS.map(({ label, surface: s, icon: Icon }) => (
            <button
              key={s}
              type="button"
              onClick={() => setSurface(s)}
              className="px-[11px] py-1.5 rounded-lg text-xs font-medium cursor-pointer flex items-center justify-center transition-colors duration-150 hover:bg-white/10"
              style={{
                background: surface === s ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: surface === s ? '#ffffff' : 'rgba(255,255,255,0.35)',
              }}
            >
              <span className="max-[360px]:hidden">{label}</span>
              <span className="hidden max-[360px]:block"><Icon size={13} strokeWidth={1.8} /></span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-5 flex-shrink-0">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="cursor-pointer">
            {expanded
              ? <ChevronDown size={20} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
              : <ChevronUp size={20} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />}
          </button>
          <button type="button" onClick={handleClose} className="cursor-pointer">
            <X size={20} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto px-4 pt-1 pb-2 no-scrollbar">
        {surface === 'voice' ? (
          <VoiceMessageList
            messages={voice.messages}
            isUploading={voice.isUploading}
            selfLabel={selfLabel}
            emptyHint={`Hi again, ${selfLabel}. In voice mode, you can chat with me by tapping the green mic button — give it a try and ask me a question!`}
            onPlaybackChange={setManualAnalyser}
          />
        ) : surface === 'calls' ? (
          callBlocks.length === 0 ? (
            <p className="text-sm text-center mt-8 px-6" style={{ color: 'rgba(255,255,255,0.35)' }}>Tap the phone to have ember call you.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {callBlocks.map((block) => <EmberCallCard key={block.voiceCallId} block={block} hideHeader />)}
            </div>
          )
        ) : surface === 'sms' ? (
          <p className="text-sm text-center mt-8 px-6" style={{ color: 'rgba(255,255,255,0.35)' }}>SMS with ember — coming soon.</p>
        ) : isLoadingHistory ? (
          <div className="flex-1 min-h-0" />
        ) : (
          <EmberChatMessages messages={messages} isSending={isSending || isLoadingWelcome} endRef={messagesEndRef} selfLabel={selfLabel} onAction={onAction} />
        )}
      </div>

      {/* Normalized toolbar — same position for all 3 modes */}
      <div className="px-4 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="flex h-12 flex-1 items-center rounded-full px-4 gap-2"
            style={{
              background: surface === 'voice' && isVoiceActive ? 'color-mix(in srgb, var(--bubble-voice-accent) 15%, transparent)' : 'var(--bg-input)',
              border: `1px solid ${surface === 'voice' && isVoiceActive ? 'color-mix(in srgb, var(--bubble-voice-accent) 45%, transparent)'
                : surface === 'chats' && chatFocused ? 'color-mix(in srgb, var(--bubble-chat-accent) 24%, transparent)'
                : 'var(--border-input)'}`,
            }}
          >
            <span style={{ marginLeft: -5 }}><EmberMark size={20} /></span>
            {PillContent()}
            {surface === 'chats' && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isSending}
                className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full cursor-pointer disabled:opacity-40"
                style={{ color: 'rgba(255,255,255,0.4)' }}
                aria-label="Add photo"
              >
                <ImagePlus size={15} />
              </button>
            )}
          </div>
          {ActionButton()}
        </div>

      </div>

      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = ''; if (file) void uploadPhoto(file); }} />
    </div>
  );
}
