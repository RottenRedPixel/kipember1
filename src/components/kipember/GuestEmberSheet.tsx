'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MessageCirclePlus, SendHorizontal, X } from 'lucide-react';
import EmberChatMessages, { type EmberChatMessage } from '@/components/kipember/EmberChatMessages';
import { EmberMark } from '@/components/kipember/EmberModalShell';
import { useToast } from '@/lib/toast';

const SNAP_MS = 320;

export type GuestEmberApi = {
  sendChat: (text: string) => Promise<string | null>;
  loadWelcome?: () => Promise<string | null>;
  loadHistory?: () => Promise<EmberChatMessage[]>;
};

export default function GuestEmberSheet({
  isOpen,
  onClose,
  api,
}: {
  isOpen: boolean;
  onClose: () => void;
  api: GuestEmberApi;
}) {
  const [showing, setShowing] = useState(isOpen);
  const [expanded, setExpanded] = useState(false);

  const [messages, setMessages] = useState<EmberChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingWelcome, setIsLoadingWelcome] = useState(false);
  const [chatFocused, setChatFocused] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const loadedRef = useRef(false);

  const { toast } = useToast();

  // Scroll to latest message
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Scroll to bottom on open
  useEffect(() => {
    if (!isOpen) return;
    const el = contentRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [isOpen]);

  // Load welcome / history on first open
  useEffect(() => {
    if (!isOpen || loadedRef.current) return;
    loadedRef.current = true;

    if (api.loadHistory) {
      api.loadHistory()
        .then((hist) => {
          if (hist.length > 0) { setMessages(hist); return; }
          loadWelcomeMessage();
        })
        .catch(() => loadWelcomeMessage());
    } else {
      loadWelcomeMessage();
    }

    function loadWelcomeMessage() {
      if (!api.loadWelcome) return;
      setIsLoadingWelcome(true);
      api.loadWelcome()
        .then((msg) => { if (msg) setMessages([{ role: 'assistant', content: msg, createdAt: new Date().toISOString() }]); })
        .catch(() => {})
        .finally(() => setIsLoadingWelcome(false));
    }
  }, [isOpen, api]);

  // Reset on close
  useEffect(() => {
    if (isOpen) {
      setShowing(true);
    } else {
      setShowing(false);
      setExpanded(false);
      loadedRef.current = false;
      setMessages([]);
      setInput('');
      setIsLoadingWelcome(false);
    }
  }, [isOpen]);

  const sendChat = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed, createdAt: new Date().toISOString() }]);
    setIsSending(true);
    try {
      const reply = await api.sendChat(trimmed);
      if (reply) setMessages((prev) => [...prev, { role: 'assistant', content: reply, createdAt: new Date().toISOString() }]);
    } catch { toast('Something went wrong.', { type: 'error' }); }
    finally { setIsSending(false); }
  }, [input, isSending, api, toast]);

  function handleClose() { setShowing(false); setExpanded(false); setTimeout(onClose, SNAP_MS); }

  function PillContent() {
    return (
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void sendChat(); } }}
        placeholder="Ask Ember about this memory..."
        className="flex-1 bg-transparent text-sm text-white outline-none min-w-0"
        style={{ caretColor: 'var(--bubble-chat-accent)' }}
        disabled={isSending}
        onFocus={() => setChatFocused(true)}
        onBlur={() => setChatFocused(false)}
      />
    );
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex flex-col"
      style={{
        height: expanded ? '100dvh' : '50vh',
        zIndex: expanded ? 50 : 10,
        background: 'var(--bg-chrome)',
        borderRadius: expanded ? 0 : '20px 20px 0 0',
        transform: showing ? 'translateY(0)' : 'translateY(100%)',
        transition: `transform ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1), height ${SNAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      {/* Header */}
      <div className="flex items-center px-4 pt-4 pb-3 gap-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-header)' }}>
        <MessageCirclePlus size={18} color="white" strokeWidth={1.8} className="flex-shrink-0" />
        <span className="font-semibold text-base flex-shrink-0 text-white">ember</span>
        <div className="ml-auto flex items-center gap-5 flex-shrink-0">
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
        <EmberChatMessages messages={messages} isSending={isSending || isLoadingWelcome} endRef={messagesEndRef} selfLabel="you" />
      </div>

      {/* Toolbar */}
      <div className="px-4 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="flex h-12 flex-1 items-center rounded-full px-4 gap-2"
            style={{
              background: 'var(--bg-input)',
              border: `1px solid ${chatFocused ? 'color-mix(in srgb, var(--bubble-chat-accent) 24%, transparent)' : 'var(--border-input)'}`,
            }}
          >
            <span style={{ marginLeft: -5 }}><EmberMark size={20} /></span>
            {PillContent()}
          </div>
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
        </div>
      </div>
    </div>
  );
}
