'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

export type ToastType = 'default' | 'success' | 'error';

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
}

interface ToastEntry {
  message: string;
  type: ToastType;
  key: number;
}

interface ToastContextValue {
  toast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [entry, setEntry] = useState<ToastEntry | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);

  const toast = useCallback((message: string, { type = 'default', duration = 3000 }: ToastOptions = {}) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    keyRef.current += 1;
    setEntry({ message, type, key: keyRef.current });
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), duration);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastBadge entry={entry} visible={visible} />
    </ToastContext.Provider>
  );
}

const TYPE_BG: Record<ToastType, string> = {
  default: 'rgba(255,255,255,0.15)',
  success: '#22c55e',
  error:   '#ef4444',
};

function ToastBadge({ entry, visible }: { entry: ToastEntry | null; visible: boolean }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? 0 : 10}px)`,
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {entry ? (
        <div
          style={{
            background: TYPE_BG[entry.type],
            borderRadius: 999,
            padding: '7px 20px',
            fontSize: 13,
            fontWeight: 500,
            color: '#fff',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
          }}
        >
          {entry.message}
        </div>
      ) : null}
    </div>
  );
}
