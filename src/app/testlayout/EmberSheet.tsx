'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronUp, ImagePlus, MessageCircle, Mic, Phone, SendHorizontal, Square, X } from 'lucide-react';
import MicLevelMeter from '@/components/kipember/workflows/MicLevelMeter';
import VoiceMessageList from '@/components/kipember/workflows/VoiceMessageList';
import { useVoiceRecording } from '@/components/kipember/workflows/useVoiceRecording';
import EmberCallCard, { type EmberCallBlock } from '@/components/kipember/EmberCallCard';
import EmberChatMessages, { type EmberChatMessage } from '@/components/kipember/EmberChatMessages';
import { EmberMark } from '@/components/kipember/EmberModalShell';
import type { EmberModalSurface } from '@/components/kipember/EmberModalShell';

const SNAP_MS = 320;
const SWIPE_THRESHOLD = 40;

const TABS: { label: string; surface: EmberModalSurface; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { label: 'chat',  surface: 'chats', icon: MessageCircle },
  { label: 'voice', surface: 'voice', icon: Mic },
  { label: 'call',  surface: 'calls', icon: Phone },
];

const SURFACE_LABEL: Record<EmberModalSurface, string> = {
  chats: 'chat with ember',
  voice: 'voice messages',
  calls: 'ember will call you',
};

export default function EmberSheet({
  isOpen,
  onClose,
  emberId,
}: {
  isOpen: boolean;
  onClose: () => void;
  emberId: string | null;
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

  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{ startY: number } | null>(null);
  const loadedRef = useRef(false);

  const voice = useVoiceRecording(emberId ?? '');

  // Scroll to latest message
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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
            .then((wd) => { if (wd?.reply) setMessages([{ role: 'assistant', content: wd.reply, createdAt: new Date().toISOString() }]); })
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
      setError('');
      setStatus('');
      setIsLoadingHistory(false);
      setIsLoadingWelcome(false);
    }
  }, [isOpen]);

  const sendChat = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending || !emberId) return;
    setError(''); setStatus(''); setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed, createdAt: new Date().toISOString() }]);
    setIsSending(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emberId, message: trimmed, inputMode: 'web' }),
      });
      const d = await r.json();
      if (d?.reply) setMessages((prev) => [...prev, { role: 'assistant', content: d.reply, createdAt: new Date().toISOString() }]);
    } catch { setError('Something went wrong.'); }
    finally { setIsSending(false); }
  }, [input, isSending, emberId]);

  const uploadPhoto = useCallback(async (file: File) => {
    if (!emberId || isUploading) return;
    setIsUploading(true); setError(''); setStatus('');
    const isVideo = file.type.startsWith('video/');
    const previewUrl = URL.createObjectURL(file);
    setMessages((prev) => [...prev, { role: 'user', content: isVideo ? 'Video' : 'Photo', imageUrl: previewUrl }]);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('emberId', emberId);
      const r = await fetch(`/api/embers/${encodeURIComponent(emberId)}/attachments`, { method: 'POST', body: form });
      const { filename } = await r.json();
      const chat = await fetch('/api/chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emberId, filename }),
      });
      const chatData = await chat.json().catch(() => null);
      setMessages((prev) => [
        ...prev.map((m) => m.imageUrl === previewUrl ? { ...m, imageUrl: undefined, imageFilename: filename } : m),
        ...(chatData?.reply ? [{ role: 'assistant' as const, content: chatData.reply }] : []),
      ]);
    } catch { setError('Failed to add content.'); }
    finally { URL.revokeObjectURL(previewUrl); setIsUploading(false); }
  }, [emberId, isUploading]);

  const triggerCall = useCallback(async () => {
    if (!emberId || isCalling) return;
    setIsCalling(true);
    try { await fetch(`/api/embers/${encodeURIComponent(emberId)}/self-invite`, { method: 'POST' }); }
    catch { setError('Something went wrong.'); }
    finally { setIsCalling(false); }
  }, [emberId, isCalling]);

  function formatPhone(raw: string) {
    const d = raw.replace(/\D/g, '');
    if (d.length === 11 && d[0] === '1') return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
    if (d.length === 10) return `+1 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
    return raw;
  }

  function handleClose() { setShowing(false); setExpanded(false); setTimeout(onClose, SNAP_MS); }

  function handlePullPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY };
  }

  function handlePullPointerUp(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dy = e.clientY - dragRef.current.startY;
    dragRef.current = null;
    if (Math.abs(dy) < 10) { if (expanded) setExpanded(false); else handleClose(); }
    else if (!expanded && dy < -SWIPE_THRESHOLD) { setExpanded(true); }
    else if (expanded && dy > SWIPE_THRESHOLD) { setExpanded(false); }
  }

  // ── Toolbar pill content ────────────────────────────────────────────────────
  const isVoiceActive = voice.isRecording || voice.isPlayingBack || !!manualAnalyser;

  function PillContent() {
    if (surface === 'voice') {
      return voice.isRecording ? (
        <MicLevelMeter stream={voice.stream} className="h-5 w-full" color="#22c55e" />
      ) : (voice.playbackAnalyser ?? manualAnalyser) ? (
        <MicLevelMeter analyser={voice.playbackAnalyser ?? manualAnalyser} className="h-5 w-full" color="#22c55e" />
      ) : (
        <span className="text-sm w-full" style={{ color: 'rgba(255,255,255,0.38)' }}>Talk with ember...</span>
      );
    }
    if (surface === 'calls') {
      return isCalling ? (
        <><span style={{ color: 'rgba(96,165,250,0.9)', fontSize: 14 }}>Calling</span><span className="text-white text-sm ml-1.5">{formatPhone(phoneNumber)}</span></>
      ) : (
        <><span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Ember will call:</span><span className="text-white text-sm ml-1.5">{formatPhone(phoneNumber)}</span></>
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
        style={{ caretColor: '#f97316' }}
        disabled={isSending}
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
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white cursor-pointer disabled:opacity-40"
          style={{ background: voice.isRecording ? '#16a34a' : '#22c55e' }}
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
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white cursor-pointer disabled:opacity-40"
          style={{ background: '#2563eb' }}
          aria-label="Call"
        >
          <Phone size={18} />
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => void sendChat()}
        disabled={isSending}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white cursor-pointer disabled:opacity-40"
        style={{ background: '#f97316' }}
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
        background: '#111113',
        borderRadius: expanded ? 0 : '20px 20px 0 0',
        transform: showing ? 'translateY(0)' : 'translateY(100%)',
        transition: `transform ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1), height ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      {/* Pull bar — collapsed only */}
      {!expanded && (
        <div
          className="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-pointer"
          onPointerDown={handlePullPointerDown}
          onPointerUp={handlePullPointerUp}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
        </div>
      )}

      {/* Header */}
      <div className="relative flex items-center px-4 pb-2 flex-shrink-0" style={{ paddingTop: expanded ? 16 : 8 }}>
        <div className="flex items-center gap-1 flex-shrink-0">
          <EmberMark size={20} />
          <span className="font-semibold text-base" style={{ color: '#f97316' }}>ember</span>
        </div>
        {/* Tabs — absolutely centered so left/right content widths don't affect position */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
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
              <span className="max-[340px]:hidden">{label}</span>
              <Icon size={13} strokeWidth={1.8} className="hidden max-[340px]:block" />
            </button>
          ))}
        </div>
        <div className="ml-auto flex-shrink-0">
          {expanded ? (
            <button type="button" onClick={handleClose} className="cursor-pointer">
              <X size={20} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
            </button>
          ) : (
            <button type="button" onClick={() => setExpanded(true)} className="w-9 h-9 flex items-center justify-center cursor-pointer">
              <ChevronUp size={18} color="rgba(255,255,255,0.35)" strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-1 pb-2 no-scrollbar">
        {surface === 'voice' ? (
          <VoiceMessageList messages={voice.messages} isUploading={voice.isUploading} selfLabel={selfLabel} onPlaybackChange={setManualAnalyser} />
        ) : surface === 'calls' ? (
          callBlocks.length === 0 ? (
            <p className="text-sm text-center mt-8 px-6" style={{ color: 'rgba(255,255,255,0.35)' }}>Tap the phone to have ember call you.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {callBlocks.map((block) => <EmberCallCard key={block.voiceCallId} block={block} hideHeader />)}
            </div>
          )
        ) : isLoadingHistory ? (
          <div className="flex-1 min-h-0" />
        ) : (
          <EmberChatMessages messages={messages} isSending={isSending || isLoadingWelcome} endRef={messagesEndRef} selfLabel={selfLabel} />
        )}
      </div>

      {/* Normalized toolbar — same position for all 3 modes */}
      <div className="px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="flex h-11 flex-1 items-center rounded-full px-4 gap-2"
            style={{
              background: surface === 'voice' && isVoiceActive ? 'rgba(34,197,94,0.15)'
                : surface === 'calls' && isCalling ? 'rgba(37,99,235,0.15)'
                : 'rgba(255,255,255,0.08)',
              border: `1px solid ${surface === 'voice' && isVoiceActive ? 'rgba(34,197,94,0.45)'
                : surface === 'calls' && isCalling ? 'rgba(37,99,235,0.45)'
                : 'transparent'}`,
            }}
          >
            <PillContent />
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
          <ActionButton />
        </div>

        {/* Status line */}
        {error || status || voice.isRecording || voice.isUploading || voice.error || isUploading ? (
          <p className="text-xs px-1 pt-1.5" style={{ color: error || voice.error ? 'rgba(255,180,180,0.92)' : 'rgba(255,255,255,0.45)' }}>
            {error || voice.error || status || (voice.isRecording ? 'Recording — tap stop when done.' : voice.isUploading ? 'Saving voice message…' : isUploading ? 'Adding to this memory...' : '')}
          </p>
        ) : null}
      </div>

      {/* Toast / error area — reserved space */}
      <div className="px-4 py-3 flex-shrink-0" />

      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = ''; if (file) void uploadPhoto(file); }} />
    </div>
  );
}
