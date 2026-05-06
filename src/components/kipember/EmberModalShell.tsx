'use client';

import Link from 'next/link';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';

export type EmberModalSurface = 'chats' | 'voice' | 'calls';

export interface EmberModalTab {
  label: string;
  surface: EmberModalSurface;
  href: string;
}

interface EmberModalShellProps {
  isOpen: boolean;
  isExpanded: boolean;
  openHref: string;
  closeHref: string;
  expandHref: string;
  collapseHref: string;
  surface: EmberModalSurface;
  tabs: EmberModalTab[];
  children?: React.ReactNode;
}

export function EmberMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="white">
      <circle cx="36" cy="36" r="7.2" fill="#f97316" />
      <rect x="32.4" y="3.18" width="7.2" height="21.6" rx="3.6" ry="3.6" />
      <rect x="32.4" y="47.22" width="7.2" height="21.6" rx="3.6" ry="3.6" />
      <rect x="10.38" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-22.02 49.98) rotate(-90)" />
      <rect x="54.42" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(22.02 94.02) rotate(-90)" />
      <rect x="47.97" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(29.55 -30.48) rotate(45)" />
      <rect x="16.83" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(42.45 .66) rotate(45)" />
      <rect x="16.83" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-8.46 20.43) rotate(-45)" />
      <rect x="47.97" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-21.36 51.57) rotate(-45)" />
    </svg>
  );
}

export default function EmberModalShell({
  isOpen,
  isExpanded,
  openHref,
  closeHref,
  expandHref,
  collapseHref,
  surface,
  tabs,
  children,
}: EmberModalShellProps) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 flex flex-col overflow-hidden"
      style={{
        top: isExpanded
          ? '25%'
          : isOpen
            ? '65%'
            : 'calc(100% - 68px)',
        background: 'var(--bg-screen)',
        WebkitBackdropFilter: 'blur(20px)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-subtle)',
        borderRadius: '30px 30px 0 0',
        transition: 'top 220ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div className="relative flex items-center gap-3 pl-4 pr-4 py-3 flex-shrink-0">
        <Link href={isOpen ? closeHref : openHref} className="flex-1 text-left">
          <span className="flex items-center gap-1">
            <EmberMark />
            <span className="text-base font-medium" style={{ color: '#f97316' }}>
              Ember
            </span>
          </span>
        </Link>
        {isOpen ? (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 rounded-xl p-1"
            style={{ background: 'var(--bg-surface)' }}
          >
            {tabs.map((tab) => (
              <Link
                key={tab.surface}
                href={tab.href}
                className="px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: surface === tab.surface ? 'var(--bg-screen)' : 'transparent',
                  color: surface === tab.surface ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        ) : null}
        {isOpen && !isExpanded ? (
          <Link
            href={expandHref}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            aria-label="Expand chat"
          >
            <ChevronUp size={18} color="var(--text-secondary)" strokeWidth={1.8} />
          </Link>
        ) : null}
        {isOpen && isExpanded ? (
          <Link
            href={collapseHref}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            aria-label="Collapse chat"
          >
            <ChevronDown size={18} color="var(--text-primary)" strokeWidth={1.8} />
          </Link>
        ) : null}
        <Link
          href={isOpen ? closeHref : openHref}
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ background: isOpen ? 'rgba(255,255,255,0.15)' : '#f97316' }}
        >
          {isOpen ? (
            <X size={18} color="var(--text-primary)" strokeWidth={1.8} />
          ) : (
            <Plus size={20} color="white" strokeWidth={2} />
          )}
        </Link>
      </div>
      {isOpen ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {children}
        </div>
      ) : null}
    </div>
  );
}
