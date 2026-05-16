'use client';

// ─── KipemberWikiContent — atom components ────────────────────────────────────
// Extracted from KipemberWikiContent.tsx (Phase 4 of wiki feature-module split).
// All atoms are pure/props-driven — zero closure dependencies on the main
// component state. Safe to import from any surface.

import Link from 'next/link';
import { useState } from 'react';
import {
  Check,
  ChevronDown,
  LoaderCircle,
  PencilLine,
  RotateCw,
} from 'lucide-react';
import { pastelForContributor } from '@/lib/contributor-color';
import { OWNER_AVATAR_BG, initials } from './utils';

// ── WikiCard ──────────────────────────────────────────────────────────────────

export function WikiCard({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl px-4 py-3.5 flex flex-col gap-1 ${
        onClick
          ? 'cursor-pointer [@media(hover:hover)]:hover:brightness-110 transition-[filter] duration-150'
          : ''
      }`}
      style={{
        background: 'var(--bg-drill-blocks)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {children}
    </div>
  );
}

// ── WikiBadge ─────────────────────────────────────────────────────────────────

/**
 * Six palettes:
 *   loading                                                       → grey "—"
 *   tracksProgress + complete (a tracker step done)              → green "Complete" + check
 *   tracksProgress + !complete + custom label (e.g. "Need 1 …")  → orange
 *   tracksProgress + !complete + default                         → red "Not Complete"
 *   !tracksProgress + count === 0                                → grey "Collected 0"
 *   !tracksProgress + count > 0 (or no count given)              → blue "Collected [N]"
 */
export function WikiBadge({
  complete,
  label,
  tracksProgress = false,
  count,
  loading = false,
}: {
  complete: boolean;
  label?: React.ReactNode;
  tracksProgress?: boolean;
  count?: number;
  loading?: boolean;
}) {
  const hasCustomLabel = label != null;
  const grey = {
    bg: 'color-mix(in srgb, var(--bg-sheets) 85%, rgb(148,163,184) 15%)',
    fg: '#94a3b8',
  };
  const palette = loading
    ? grey
    : tracksProgress
    ? complete
      ? { bg: 'color-mix(in srgb, var(--bg-sheets) 85%, rgb(34,197,94) 15%)', fg: 'var(--color-success)' }
      : hasCustomLabel
      ? { bg: 'color-mix(in srgb, var(--bg-sheets) 85%, rgb(249,115,22) 15%)', fg: 'var(--color-accent)' }
      : { bg: 'color-mix(in srgb, var(--bg-sheets) 85%, rgb(239,68,68) 15%)', fg: '#f87171' }
    : count === 0
    ? grey
    : { bg: 'color-mix(in srgb, var(--bg-sheets) 85%, rgb(59,130,246) 15%)', fg: '#60a5fa' };

  const collectedDefault =
    typeof count === 'number' ? (
      <>
        Collected <span className="text-white">{count}</span>
      </>
    ) : (
      'Collected'
    );

  return (
    <span
      className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 inline-flex items-center gap-1"
      style={{ background: palette.bg, color: palette.fg }}
    >
      {!loading && tracksProgress && complete ? (
        <Check size={11} strokeWidth={3} color="#ffffff" aria-hidden />
      ) : null}
      {loading ? (
        <LoaderCircle size={11} strokeWidth={2.5} className="animate-spin" aria-hidden />
      ) : (
        label ?? (tracksProgress ? (complete ? 'Complete' : 'Not Complete') : collectedDefault)
      )}
    </span>
  );
}

// ── WikiGroup ─────────────────────────────────────────────────────────────────

/**
 * Collapsible band header that wraps a whole group of sections.
 * Used for the five bands: Identity, Curation, Observed, Conversations, Control.
 */
export function WikiGroup({
  label,
  defaultCollapsed = false,
  children,
}: {
  label: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <div className="flex flex-col gap-7">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex items-center gap-3 px-1 py-2 cursor-pointer w-full"
        style={{ background: 'transparent', border: 'none' }}
      >
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
        <span className="text-white/30 text-xs uppercase tracking-wider font-medium">{label}</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
      </button>
      {collapsed ? null : children}
    </div>
  );
}

// ── WikiSection ───────────────────────────────────────────────────────────────

export function WikiSection({
  icon,
  title,
  complete,
  badgeLabel,
  editHref,
  onEdit,
  collapsible = false,
  defaultCollapsed = false,
  hideBadge = false,
  tracksProgress = false,
  count,
  id,
  loading = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  complete: boolean;
  badgeLabel?: React.ReactNode;
  editHref?: string;
  onEdit?: () => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  hideBadge?: boolean;
  tracksProgress?: boolean;
  count?: number;
  id?: string;
  loading?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isHidden = collapsible && collapsed;

  const headerInner = (
    <>
      <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
      <h3 className="text-white font-medium text-base">{title}</h3>
      {collapsible ? (
        <ChevronDown
          size={14}
          color="var(--text-secondary)"
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      ) : null}
    </>
  );

  return (
    <div id={id} className="flex flex-col gap-3 scroll-mt-4">
      <div className="flex items-center justify-between">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            className="flex items-center gap-2 cursor-pointer"
            style={{ background: 'transparent', border: 'none', padding: 0, minHeight: 44 }}
          >
            {headerInner}
          </button>
        ) : (
          <div className="flex items-center gap-2">{headerInner}</div>
        )}
        <div className="flex items-center gap-2">
          {editHref ? (
            <Link
              href={editHref}
              aria-label={`Edit ${title}`}
              className="flex items-center justify-center rounded-full can-hover"
              style={{
                width: 28,
                height: 28,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <PencilLine size={13} />
            </Link>
          ) : null}
          {hideBadge ? null : (
            <WikiBadge
              complete={complete}
              label={badgeLabel}
              tracksProgress={tracksProgress}
              count={count}
              loading={loading}
            />
          )}
        </div>
      </div>
      {isHidden ? null : onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="w-full text-left cursor-pointer [@media(hover:hover)]:hover:brightness-110 transition-[filter] duration-150"
          style={{ background: 'none', border: 'none', padding: 0 }}
        >
          {children}
        </button>
      ) : (
        children
      )}
    </div>
  );
}

// ── ReconciliationPill ────────────────────────────────────────────────────────

export function ReconciliationPill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'warn' | 'good';
}) {
  const stylesByTone = {
    neutral: {
      background: 'var(--bg-input)',
      color: 'rgba(255,255,255,0.55)',
      border: '1px solid var(--border-subtle)',
    },
    warn: {
      background: 'var(--bubble-chat-bg)',
      color: 'rgba(253,186,116,0.95)',
      border: '1px solid var(--bubble-chat-border)',
    },
    good: {
      background: 'var(--color-success-bg)',
      color: 'rgba(134,239,172,0.95)',
      border: '1px solid var(--color-success-border)',
    },
  } as const;

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em]"
      style={stylesByTone[tone]}
    >
      {children}
    </span>
  );
}

// ── RefreshFooter ─────────────────────────────────────────────────────────────

export function RefreshFooter({ onRefresh }: { onRefresh?: () => unknown }) {
  if (!onRefresh) return null;
  return (
    <>
      <div className="mt-3 h-px" style={{ background: 'var(--border-subtle)' }} />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void onRefresh();
        }}
        className="flex flex-col items-center gap-1 mx-auto mt-2 cursor-pointer text-white/40 text-[10px] font-semibold uppercase tracking-wider [@media(hover:hover)]:hover:text-white/70 transition-colors"
        style={{ background: 'transparent', border: 'none', padding: '4px 8px' }}
      >
        <RotateCw size={14} strokeWidth={2} />
        Refresh
      </button>
    </>
  );
}

// ── AvatarCircle ──────────────────────────────────────────────────────────────

/**
 * Circular avatar: shows `avatarUrl` when present, otherwise an initials
 * bubble whose colour is deterministically keyed on the person's name.
 * Initials read in white on the owner's orange swatch, dark grey on pastels.
 */
export function AvatarCircle({
  name,
  avatarUrl,
  size = 29,
  bgColor,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  bgColor?: string;
}) {
  const fallbackBg = bgColor ?? pastelForContributor(name);
  const initialsColor = fallbackBg === OWNER_AVATAR_BG ? '#ffffff' : '#1f2937';
  return avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt={name}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
      style={{ width: size, height: size, background: fallbackBg, color: initialsColor }}
    >
      {initials(name)}
    </div>
  );
}
