'use client';

import Link from 'next/link';
import {
  Check,
  Hand,
  Home,
  ImagePlus,
  Link2,
  Mail,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Phone,
  ScanEye,
  SendHorizontal,
  Share2,
  Square,
  X,
} from 'lucide-react';
import EmberModalShell, { type EmberModalSurface } from '@/components/kipember/EmberModalShell';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getEmberTitle } from '@/lib/ember-title';
import { getPreviewMediaUrl } from '@/lib/media';
import MicLevelMeter from '@/components/kipember/workflows/MicLevelMeter';
import VoiceMessageList from '@/components/kipember/workflows/VoiceMessageList';
import { useGuestVoiceRecording } from '@/components/kipember/workflows/useGuestVoiceRecording';
import KipemberPlayOverlay from '@/components/kipember/KipemberPlayOverlay';

type ContributorAttachment = {
  id: string;
  filename: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO';
  posterFilename: string | null;
};

type ContributorData = {
  contributor: {
    id: string;
    name: string | null;
    firstName: string | null;
    phoneNumber: string | null;
    hasPassword: boolean;
  } | null;
  ember: {
    id: string;
    filename: string;
    mediaType: 'IMAGE' | 'VIDEO';
    posterFilename: string | null;
    durationSeconds: number | null;
    originalName: string;
    title: string | null;
    description: string | null;
    createdAt: string;
  };
  attachments: ContributorAttachment[];
  snapshotScript: string | null;
  latestVoiceCall: {
    id: string;
    status: string;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
  } | null;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  imageUrl?: string;
  imageFilename?: string;
};

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return raw;
}

function Modal({ children, closeHref }: { children: React.ReactNode; closeHref: string }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center pb-24">
      <Link href={closeHref} className="absolute inset-0" />
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-modal)',
          WebkitBackdropFilter: 'blur(5px)',
          backdropFilter: 'blur(5px)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <Link href={closeHref} className="absolute top-3 right-3 text-white/60 z-10 w-8 h-8 flex items-center justify-center">
          <X size={18} />
        </Link>
        {children}
      </div>
    </div>
  );
}

function RailBtn({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.40)', WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}
      >
        <Icon size={23} color="var(--text-primary)" strokeWidth={1.8} />
      </div>
      <span className="text-white text-xs font-medium lowercase">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10 active:bg-white/20">
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10 active:bg-white/20 cursor-pointer">
      {inner}
    </button>
  );
}

// Inline workflow component — owns chat, voice, and call surfaces
function ContributorWorkflow({
  token,
  phoneNumber,
  surface,
}: {
  token: string;
  phoneNumber: string;
  surface: 'chats' | 'voice' | 'calls';
}) {
  const voice = useGuestVoiceRecording(token);
  const [manualAnalyser, setManualAnalyser] = useState<AnalyserNode | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load welcome message on first open
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

  async function triggerCall() {
    if (isCalling) return;
    setIsCalling(true);
    try {
      const response = await fetch(`/api/contribute/${token}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  async function handleUpload(file: File) {
    if (isUploading) return;
    setIsUploading(true);
    setError('');
    const isVideo = file.type.startsWith('video/');
    const previewUrl = URL.createObjectURL(file);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: isVideo ? 'Video' : 'Photo', imageUrl: previewUrl, createdAt: new Date().toISOString() },
    ]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/contribute/${token}/upload`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to add content.');
      const uploadedFilename: string | null = payload?.attachment?.filename ?? null;
      const reply = typeof payload?.response === 'string' ? payload.response.trim() : '';
      setMessages((prev) => [
        ...prev.map((m) =>
          'imageUrl' in m && m.imageUrl === previewUrl
            ? { ...m, imageUrl: undefined, imageFilename: uploadedFilename ?? undefined }
            : m
        ),
        ...(reply ? [{ role: 'assistant' as const, content: reply, createdAt: new Date().toISOString() }] : []),
      ]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to add content.');
    } finally {
      URL.revokeObjectURL(previewUrl);
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col px-4 pb-4 pt-1">
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

      {surface === 'voice' ? (
        <div className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1 no-scrollbar">
          <VoiceMessageList messages={voice.messages} isUploading={voice.isUploading} onPlaybackChange={setManualAnalyser} />
        </div>
      ) : surface === 'calls' ? (
        <div className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1 no-scrollbar">
          <p className="text-white/40 text-sm text-center mt-8 px-6">
            Tap the phone icon below to have ember call you.
          </p>
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

      {surface === 'voice' ? (
        /* Voice toolbar */
        <div className="flex items-end gap-2 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div
              className="flex h-11 w-full items-center rounded-full px-4"
              style={{
                background: (voice.isRecording || voice.isPlayingBack || !!manualAnalyser) ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.07)',
                border: `1px solid ${(voice.isRecording || voice.isPlayingBack || !!manualAnalyser) ? 'rgba(34,197,94,0.45)' : 'rgba(34,197,94,0.18)'}`,
              }}
            >
              {voice.isRecording ? (
                <MicLevelMeter stream={voice.stream} className="h-5 w-full" color="#22c55e" />
              ) : (voice.playbackAnalyser ?? manualAnalyser) ? (
                <MicLevelMeter analyser={voice.playbackAnalyser ?? manualAnalyser} className="h-5 w-full" color="#22c55e" />
              ) : (
                <div className="h-5 w-full" />
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
      ) : surface === 'calls' ? (
        /* Call toolbar */
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
                  <span className="text-white/50">ember will call:</span>
                  <span className="text-white">{phoneNumber ? formatPhone(phoneNumber) : '—'}</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void triggerCall()}
            disabled={isCalling || !phoneNumber}
            className="flex h-11 w-11 items-center justify-center rounded-full transition disabled:opacity-40 cursor-pointer"
            style={{ background: '#2563eb', color: 'white' }}
            aria-label="Have ember call me"
          >
            <Phone size={18} />
          </button>
        </div>
      ) : (
        /* Chat toolbar */
        <form onSubmit={(e) => { e.preventDefault(); void sendMessage(input); }} className="flex items-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isSending}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition disabled:opacity-40 cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.08)' }}
            aria-label="Add photo"
          >
            <ImagePlus size={18} />
          </button>
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Ember about this memory..."
              className="w-full rounded-full border border-transparent bg-white/8 px-4 py-3 pr-11 text-sm text-white outline-none placeholder:text-white/38 focus:border-[rgba(249,115,22,0.24)]"
              disabled={isSending}
            />
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

      {voice.isRecording || voice.isUploading || voice.error || isUploading || error ? (
        <div className="px-2 pt-2 text-xs">
          {error ? (
            <p className="text-[rgba(255,180,180,0.92)]">{error}</p>
          ) : voice.error ? (
            <p className="text-[rgba(255,180,180,0.92)]">{voice.error}</p>
          ) : voice.isRecording ? (
            <p style={{ color: 'rgba(34,197,94,0.7)' }}>Recording — tap stop when done.</p>
          ) : voice.isUploading ? (
            <p className="text-white/48">Saving voice message…</p>
          ) : isUploading ? (
            <p className="text-white/48">Adding to this memory...</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function ContributorNPWFlow({ token }: { token: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const rawFlow = params.get('ember');
  const view = params.get('view');
  const modal = params.get('m');
  const rawSurface = params.get('chat');

  const flowOpen = rawFlow === 'contributor';
  const emberModalExpanded = flowOpen && view === 'full';
  const emberModalOpen = flowOpen;
  const emberModalSurface: EmberModalSurface =
    rawSurface === 'voice' ? 'voice' : rawSurface === 'calls' ? 'calls' : 'chats';

  const [data, setData] = useState<ContributorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [helloDismissed, setHelloDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHelloDismissed(!!localStorage.getItem(`hello-dismissed-${token}`));
    }
  }, [token]);

  const copyShareLink = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard API unavailable; visual feedback still fires below */
    }
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/contribute/${token}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load this memory');
      const payload = (await response.json()) as ContributorData;
      setData({ ...payload, attachments: payload.attachments ?? [], snapshotScript: payload.snapshotScript ?? null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this memory');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Skip hello modal if already dismissed
  useEffect(() => {
    if (modal === 'hello' && typeof window !== 'undefined') {
      if (localStorage.getItem(`hello-dismissed-${token}`)) {
        const p = new URLSearchParams(params.toString());
        p.delete('m');
        const q = p.toString();
        const dest = `/contribute/${token}`;
        router.replace(q ? `${dest}?${q}` : dest);
      }
    }
  }, [modal, token, params, router]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex justify-center" style={{ background: 'var(--bg-screen)' }}>
        <div className="relative w-full max-w-xl h-full flex items-center justify-center">
          <p className="text-white/60 text-sm">Loading memory...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 flex justify-center" style={{ background: 'var(--bg-screen)' }}>
        <div className="relative w-full max-w-xl h-full flex flex-col items-center justify-center px-6">
          <p className="text-white font-medium text-base mb-2">Memory not found</p>
          <p className="text-white/60 text-sm text-center mb-6">{error || 'This memory is no longer available.'}</p>
          <Link
            href="/"
            className="px-8 rounded-full text-white text-sm font-medium"
            style={{ background: '#f97316', minHeight: 44, display: 'flex', alignItems: 'center' }}
          >
            Back to Ember
          </Link>
        </div>
      </div>
    );
  }

  const title = getEmberTitle({ title: data.ember.title, originalName: data.ember.originalName });
  const subtitle = data.ember.createdAt
    ? new Date(data.ember.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';
  const mainUrl = getPreviewMediaUrl({
    mediaType: data.ember.mediaType,
    filename: data.ember.filename,
    posterFilename: data.ember.posterFilename,
  });

  const allMedia = [
    { url: mainUrl },
    ...data.attachments.map((a) => ({
      url: getPreviewMediaUrl({ mediaType: a.mediaType, filename: a.filename, posterFilename: a.posterFilename }),
    })),
  ];
  const currentPhotoUrl = allMedia[photoIndex]?.url ?? mainUrl;
  const nextPhotoUrl = allMedia.length > 1 ? allMedia[(photoIndex + 1) % allMedia.length]?.url : null;
  const phoneNumber = data.contributor?.phoneNumber ?? '';

  const base = `/contribute/${token}`;
  const buildHref = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    const query = next.toString();
    return query ? `${base}?${query}` : base;
  };

  const openHref = buildHref({ ember: 'contributor', m: null });
  const closeHref = buildHref({ ember: null, view: null, chat: null, m: null });
  const expandHref = buildHref({ view: 'full' });
  const collapseHref = buildHref({ view: null });
  const chatTabHref = buildHref({ chat: null });
  const voiceTabHref = buildHref({ chat: 'voice' });
  const callTabHref = buildHref({ chat: 'calls' });
  const shareUrl = typeof window !== 'undefined' ? window.location.origin + base : base;

  const railHidden = emberModalOpen || modal === 'share' || modal === 'play' || modal === 'hello';

  return (
    <div className="fixed inset-0 flex justify-center" style={{ background: 'var(--bg-screen)' }}>
      <div className="relative w-full max-w-xl h-full">
        {/* Background blur layer */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${currentPhotoUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(24px)',
              transform: 'scale(1.08)',
              opacity: 0.7,
            }}
          />
          <img
            src={currentPhotoUrl}
            alt=""
            className="absolute pointer-events-none"
            style={
              emberModalExpanded
                ? {
                    top: 56,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    height: 'calc(25vh - 56px)',
                    width: 'auto',
                    objectFit: 'contain',
                    objectPosition: 'center center',
                  }
                : {
                    top: 56,
                    bottom: 72,
                    left: 0,
                    right: 0,
                    width: '100%',
                    height: 'calc(100% - 128px)',
                    objectFit: 'contain',
                    objectPosition: 'center center',
                  }
            }
          />
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.55) 100%)' }}
        />

        {/* Photo dot indicators */}
        {allMedia.length > 1 && !emberModalExpanded ? (
          <div
            className="absolute left-1/2 flex items-center gap-1.5 pointer-events-none z-10"
            style={{ bottom: 88, transform: 'translateX(-50%)' }}
          >
            {allMedia.map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: idx === photoIndex ? '#ffffff' : 'rgba(255,255,255,0.35)',
                  boxShadow: idx === photoIndex ? '0 1px 3px rgba(0,0,0,0.5)' : 'none',
                  transition: 'background 200ms ease',
                }}
              />
            ))}
          </div>
        ) : null}

        {/* Header */}
        <div
          className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4"
          style={{ height: 56, background: 'var(--bg-screen)', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <Link
            href="/"
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--bg-rail-btn)' }}
            aria-label="Home"
          >
            <Home size={18} color="var(--text-primary)" strokeWidth={1.8} />
          </Link>
          <div className="w-9 h-9" />
        </div>

        {/* Title overlay */}
        {!emberModalExpanded ? (
          <div className="absolute left-4 z-20 pointer-events-none" style={{ top: 64 }}>
            <p className="text-white font-medium text-base leading-tight" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
              {title}
            </p>
            {subtitle ? (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                {subtitle}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Right rail */}
        <div
          className={`absolute right-2 z-20 flex flex-col gap-0 items-center transition-opacity duration-200 ${
            railHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          style={{ bottom: '9%' }}
        >
          {allMedia.length > 1 && nextPhotoUrl ? (
            <button
              type="button"
              onClick={() => setPhotoIndex((i) => (i + 1) % allMedia.length)}
              className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10 active:bg-white/20 cursor-pointer"
            >
              <div className="relative w-11 h-11">
                <div className="w-11 h-11 rounded-full overflow-hidden">
                  <img src={nextPhotoUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1" style={{ background: '#f97316', fontSize: 10, fontWeight: 600, color: '#fff', lineHeight: 1 }}>
                  {allMedia.length}
                </div>
              </div>
              <span className="text-white text-xs font-medium lowercase">more</span>
            </button>
          ) : null}
          {!helloDismissed ? (
            <Link href={buildHref({ m: 'hello' })} className="flex flex-col items-center gap-1 p-2 rounded-xl">
              <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: '#f97316' }}>
                <Hand size={23} color="#fff" strokeWidth={1.8} />
              </div>
              <span className="text-white text-xs font-medium lowercase">hello!</span>
            </Link>
          ) : null}
          <RailBtn icon={Share2} label="share" href={buildHref({ m: 'share' })} />
          <RailBtn icon={ScanEye} label="view" href={buildHref({ m: 'play' })} />
        </div>

        {/* Share modal */}
        {modal === 'share' ? (
          <Modal closeHref={buildHref({ m: null })}>
            <div className="flex flex-col items-center pt-6 pb-4 gap-2">
              <div className="rounded-full flex items-center justify-center" style={{ width: 55, height: 55, background: '#4a6172' }}>
                <Share2 size={28} color="#c8dce8" strokeWidth={1.6} />
              </div>
              <span className="text-white text-base font-medium">Share this ember</span>
            </div>
            <div className="mx-5" style={{ borderTop: '1px solid var(--border-default)' }} />
            <div className="p-5 grid grid-cols-3 gap-1">
              <button type="button" className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" onClick={() => void copyShareLink(shareUrl)}><div className="w-11 h-11 flex items-center justify-center"><Link2 size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">Copy Link</span></button>
              <button type="button" className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" onClick={() => window.location.assign(`sms:?&body=${encodeURIComponent(shareUrl)}`)}><div className="w-11 h-11 flex items-center justify-center"><MessageCircle size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">Message</span></button>
              <a href={`mailto:?body=${encodeURIComponent(shareUrl)}`} className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover"><div className="w-11 h-11 flex items-center justify-center"><Mail size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">Email</span></a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" target="_blank" rel="noreferrer"><div className="w-11 h-11 flex items-center justify-center"><Share2 size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">Facebook</span></a>
              <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`} className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" target="_blank" rel="noreferrer"><div className="w-11 h-11 flex items-center justify-center"><Share2 size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">X / Twitter</span></a>
              <button type="button" className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" onClick={() => navigator.share?.({ title, url: shareUrl })}><div className="w-11 h-11 flex items-center justify-center"><MoreHorizontal size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">More</span></button>
            </div>
            <div className="mx-5 mb-5">
              {copyStatus === 'copied' ? (
                <p className="text-xs text-center mb-2" style={{ color: '#4ade80' }}>
                  Link copied to clipboard
                </p>
              ) : null}
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <span className="flex-1 text-xs text-white/50 truncate">{shareUrl}</span>
                <button
                  type="button"
                  onClick={() => void copyShareLink(shareUrl)}
                  className="flex-shrink-0 text-xs font-medium px-2 py-1 rounded-md cursor-pointer"
                  style={{ color: copyStatus === 'copied' ? '#4ade80' : '#f97316' }}
                >
                  {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </Modal>
        ) : null}

        {/* Hello modal */}
        {modal === 'hello' ? (
          <Modal closeHref={buildHref({ m: null })}>
            <div className="flex flex-col items-center pt-6 pb-4 gap-2">
              <div className="rounded-full flex items-center justify-center" style={{ width: 55, height: 55, background: '#f97316' }}>
                <Hand size={28} color="#fff" strokeWidth={1.6} />
              </div>
              <span className="text-white text-base font-medium">
                {data?.contributor ? `Hello ${data.contributor.firstName ?? 'there'}!` : 'Welcome!'}
              </span>
              <p className="text-white/60 text-sm text-center px-6 pb-2">
                {data?.contributor
                  ? "You've been invited to help build this memory. Add photos, share stories, and contribute what you remember."
                  : "You've been invited to contribute to this memory. Explore the story and chat with Ember."}
              </p>
            </div>
            <div className="mx-5" style={{ borderTop: '1px solid var(--border-default)' }} />
            <div className="px-5 pt-3 pb-4">
              {data?.contributor && data.contributor.hasPassword ? (
                <Link
                  href={`/login?next=${encodeURIComponent(`/inbound/${token}`)}`}
                  className="flex items-center justify-center rounded-full text-white text-sm font-medium w-full"
                  style={{ background: '#f97316', minHeight: 44 }}
                >
                  Login
                </Link>
              ) : data?.contributor && !data.contributor.hasPassword ? (
                <Link
                  href={`/api/contribute/${token}/claim`}
                  className="flex items-center justify-center rounded-full text-white text-sm font-medium w-full"
                  style={{ background: '#f97316', minHeight: 44 }}
                >
                  Create Account
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const next = !helloDismissed;
                    setHelloDismissed(next);
                    if (next) {
                      localStorage.setItem(`hello-dismissed-${token}`, '1');
                    } else {
                      localStorage.removeItem(`hello-dismissed-${token}`);
                    }
                  }}
                  className="flex items-center justify-center gap-2 w-full cursor-pointer"
                  style={{ padding: '6px 0' }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: `1px solid ${helloDismissed ? '#f97316' : 'rgba(255,255,255,0.25)'}`,
                    background: helloDismissed ? '#f97316' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {helloDismissed ? <Check size={10} color="#fff" strokeWidth={3} /> : null}
                  </div>
                  <span className="text-white/40 text-xs">Don't show again</span>
                </button>
              )}
            </div>
          </Modal>
        ) : null}

        {/* Play overlay */}
        {modal === 'play' ? (
          <KipemberPlayOverlay
            closeHref={buildHref({ m: null })}
            emberId={data.ember.id}
            storyScript={data.snapshotScript}
            guestToken={token}
          />
        ) : null}

        <EmberModalShell
          isOpen={emberModalOpen}
          isExpanded={emberModalExpanded}
          openHref={openHref}
          closeHref={closeHref}
          expandHref={expandHref}
          collapseHref={collapseHref}
          surface={emberModalSurface}
          tabs={[
            { label: 'Chat', surface: 'chats', href: chatTabHref },
            { label: 'Voice', surface: 'voice', href: voiceTabHref },
            { label: 'Call', surface: 'calls', href: callTabHref },
          ]}
        >
          <ContributorWorkflow token={token} phoneNumber={phoneNumber} surface={emberModalSurface} />
        </EmberModalShell>
      </div>
    </div>
  );
}
