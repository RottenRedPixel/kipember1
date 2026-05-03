'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ChevronDown,
  Mail,
  MessageSquarePlus,
  Phone,
  Sparkles,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type { TaggedPhoto, UnifiedContributor } from '@/lib/contributors-pool';
import { getPreviewMediaUrl } from '@/lib/media';

const SORT_OPTIONS = ['Name', 'Most Embers'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

function compareContributors(a: UnifiedContributor, b: UnifiedContributor, sort: SortOption): number {
  if (sort === 'Most Embers') {
    if (b.emberCount !== a.emberCount) return b.emberCount - a.emberCount;
    return a.name.localeCompare(b.name);
  }
  return a.name.localeCompare(b.name);
}

type EmberContext = {
  kind: 'ember';
  emberId: string;
  canManage: boolean;
  /** Where to send the user when they tap "Add Contributor" (new). */
  addNewHref: string;
  /** Builder for the row's drill-down link given the contributor key on this ember. */
  rowDetailHref: (params: { contributorIdOnThisEmber: string }) => string;
  /** Current filter selection (controlled via URL). */
  filter: 'ember' | 'all';
  /** Hrefs for switching the filter (the toggle pill is rendered as Links so back nav works). */
  filterHrefs: { ember: string; all: string };
};

export type AccountFilter = 'with-ember' | 'without-ember';

type AccountContext = {
  kind: 'account';
  /** Builder for the row's drill-down link — for /account this points at /tend/contributors with from=account. */
  rowDetailHref: (params: { contributor: UnifiedContributor }) => string;
  /** Current filter state for the With/Without Ember toggle. */
  filter: AccountFilter;
  /** Called when the user clicks a different filter pill. */
  onFilterChange: (filter: AccountFilter) => void;
};

export type ContributorsListContext = EmberContext | AccountContext;

function initialsOf(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}

/**
 * Show a face thumbnail by cropping into the source photo using the
 * stored bounding-box percentages. Pixel-precise: scales the image so
 * the face box fills the circle, then shifts to center the face.
 */
function FaceCrop({ photo, size = 40 }: { photo: TaggedPhoto; size?: number }) {
  const url = getPreviewMediaUrl({
    mediaType: photo.mediaType,
    filename: photo.filename,
    posterFilename: photo.posterFilename,
  });
  const widthPct = Math.max(photo.widthPct, 0.001);
  const heightPct = Math.max(photo.heightPct, 0.001);
  return (
    <div
      className="rounded-full flex-shrink-0 overflow-hidden relative"
      style={{ width: size, height: size, background: 'rgba(100,116,139,0.6)' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          width: `${(100 / widthPct) * 100}%`,
          height: `${(100 / heightPct) * 100}%`,
          left: `${(-photo.leftPct * 100) / widthPct}%`,
          top: `${(-photo.topPct * 100) / heightPct}%`,
          maxWidth: 'none',
          objectFit: 'cover',
        }}
      />
    </div>
  );
}

function rowSubtext(c: UnifiedContributor, ctx: ContributorsListContext): string | null {
  if (ctx.kind === 'ember') {
    if (ctx.filter === 'ember') {
      // On the current ember — show contact info to be useful in the row.
      return c.email || c.phoneNumber || null;
    }
    // Filter = all
    if (c.onThisEmber) return 'On this ember';
    const others = c.emberCount;
    return others === 1 ? 'On 1 other ember' : `On ${others} other embers`;
  }
  // Account context — pure roster view, show ember count.
  if (c.emberCount === 1) return 'On 1 ember';
  return `On ${c.emberCount} embers`;
}

export default function ContributorsListView({
  contributors,
  context,
}: {
  contributors: UnifiedContributor[];
  context: ContributorsListContext;
}) {
  const [pendingAdd, setPendingAdd] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);

  // Sort dropdown — open state lives in URL? Component-level for v1; opening is rare.
  const [sort, setSort] = useState<SortOption>('Name');
  const [sortOpen, setSortOpen] = useState(false);

  // For /account: split the pool by whether the contributor has any
  // EmberContributor join rows yet. "With Ember" = on at least one ember;
  // "Without Ember" = pool entries that haven't been attached to anything.
  const filtered = (() => {
    if (context.kind !== 'account') return contributors;
    if (context.filter === 'with-ember') return contributors.filter((c) => c.emberCount > 0);
    return contributors.filter((c) => c.emberCount === 0);
  })();

  const sorted = [...filtered].sort((a, b) => compareContributors(a, b, sort));

  async function handleAddExisting(sourceKey: string) {
    if (context.kind !== 'ember') return;
    setPendingAdd(sourceKey);
    setAddError(null);
    try {
      const res = await fetch('/api/contributors/add-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: context.emberId, sourceKey }),
      });
      const payload = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) {
        setAddError(payload?.error || 'Failed to add contributor.');
        return;
      }
      // Optimistically mark as added — the next list refresh from the server will reflect it.
      setAddedKeys((prev) => new Set([...prev, sourceKey]));
    } catch {
      setAddError('Network error. Try again.');
    } finally {
      setPendingAdd(null);
    }
  }

  // The pill toggle: ember context = This Ember | All; account context =
  // With Ember | Without Ember (both filter the owner's pool).
  const isEmber = context.kind === 'ember';

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar — pill toggle (left) + sort dropdown (right) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--bg-surface)' }}>
          {isEmber ? (
            <>
              <Link
                href={context.filterHrefs.ember}
                replace
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: context.filter === 'ember' ? 'var(--bg-screen)' : 'transparent',
                  color: context.filter === 'ember' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                This Ember
              </Link>
              <Link
                href={context.filterHrefs.all}
                replace
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: context.filter === 'all' ? 'var(--bg-screen)' : 'transparent',
                  color: context.filter === 'all' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                All
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => context.onFilterChange('with-ember')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                style={{
                  background: context.filter === 'with-ember' ? 'var(--bg-screen)' : 'transparent',
                  color: context.filter === 'with-ember' ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                }}
              >
                With Ember
              </button>
              <button
                type="button"
                onClick={() => context.onFilterChange('without-ember')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                style={{
                  background: context.filter === 'without-ember' ? 'var(--bg-screen)' : 'transparent',
                  color: context.filter === 'without-ember' ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                }}
              >
                Without Ember
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((s) => !s)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl can-hover"
              style={{ background: 'var(--bg-surface)', opacity: 0.9, cursor: 'pointer' }}
            >
              <span className="text-white text-xs font-medium">{sort}</span>
              <ChevronDown size={13} color="var(--text-secondary)" strokeWidth={2} />
            </button>
            {sortOpen ? (
              <div
                className="absolute top-full right-0 mt-1 rounded-xl overflow-hidden z-10 flex flex-col"
                style={{ background: 'var(--bg-screen)', border: '1px solid var(--border-default)', minWidth: 130 }}
              >
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => { setSort(option); setSortOpen(false); }}
                    className="px-4 py-2.5 text-xs font-medium can-hover text-left"
                    style={{ color: option === sort ? '#f97316' : 'var(--text-primary)', opacity: 0.9, cursor: 'pointer' }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {addError && (
        <p className="text-xs px-1" style={{ color: '#f87171' }}>{addError}</p>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-white/30 text-sm px-4 py-4">No contributors yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((c) => {
            const sub = rowSubtext(c, context);
            const justAdded = addedKeys.has(c.key);
            const onThis = c.onThisEmber || justAdded;

            // Drill-down target — depends on context.
            let detailHref: string | null = null;
            if (context.kind === 'ember') {
              if (onThis && c.currentEmberContributorId) {
                detailHref = context.rowDetailHref({ contributorIdOnThisEmber: c.currentEmberContributorId });
              }
            } else {
              detailHref = context.rowDetailHref({ contributor: c });
            }

            // Right-side action (only relevant in ember+all when not on this ember)
            const showAddAction =
              context.kind === 'ember' && context.filter === 'all' && !onThis;

            const facePhoto = c.taggedPhotos[0] ?? null;
            const tagSubtext =
              c.taggedPhotoCount > 1
                ? `Tagged in ${c.taggedPhotoCount} photos`
                : c.taggedPhotoCount === 1
                  ? `Tagged in ${facePhoto?.emberTitle || '1 photo'}`
                  : null;
            const rowInner = (
              <>
                {facePhoto ? (
                  <FaceCrop photo={facePhoto} size={40} />
                ) : (
                  <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-white text-sm font-medium" style={{ background: 'rgba(100,116,139,0.6)' }}>
                    {c.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
                    ) : initialsOf(c.name)}
                  </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-white text-sm font-medium truncate">{c.name}</span>
                  {sub && <span className="text-white/25 text-xs truncate">{sub}</span>}
                  {tagSubtext && (
                    <span className="text-orange-500/80 text-[10px] truncate">{tagSubtext}</span>
                  )}
                </div>
              </>
            );

            return (
              <div
                key={c.key}
                className="flex items-center rounded-xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                {detailHref ? (
                  <Link
                    href={detailHref}
                    draggable={false}
                    className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 can-hover"
                    style={{ minHeight: 44, opacity: 0.9, cursor: 'pointer' }}
                  >
                    {rowInner}
                  </Link>
                ) : (
                  <div
                    className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3"
                    style={{ minHeight: 44, opacity: 0.9 }}
                  >
                    {rowInner}
                  </div>
                )}

                {showAddAction ? (
                  <button
                    type="button"
                    onClick={() => void handleAddExisting(c.key)}
                    disabled={pendingAdd === c.key}
                    aria-label={`Add ${c.name} to this ember`}
                    className="flex items-center justify-center rounded-full mr-2 disabled:opacity-50"
                    style={{
                      width: 32,
                      height: 32,
                      background: '#f97316',
                      flexShrink: 0,
                      cursor: pendingAdd === c.key ? 'default' : 'pointer',
                    }}
                  >
                    <UserPlus size={16} color="white" strokeWidth={2.5} />
                  </button>
                ) : (
                  <>
                    <div className="w-7 h-11 flex items-center justify-center flex-shrink-0" style={{ opacity: 0.4 }} title="Invited">
                      <Mail size={15} color="var(--text-primary)" strokeWidth={1.8} />
                    </div>
                    <div className="w-7 h-11 flex items-center justify-center flex-shrink-0" style={{ opacity: 0.4 }} title="Contributed">
                      <Sparkles size={15} color="var(--text-primary)" strokeWidth={1.8} />
                    </div>
                    <div className="w-7 h-11 flex items-center justify-center flex-shrink-0" style={{ opacity: 0.4 }} title="Account created">
                      <UserCheck size={15} color="var(--text-primary)" strokeWidth={1.8} />
                    </div>
                    <div className="h-5 w-px flex-shrink-0 mx-1" style={{ background: 'var(--border-subtle)' }} />
                    <div className="w-7 h-11 flex items-center justify-center flex-shrink-0" style={{ opacity: 0.4 }} title="Send text">
                      <MessageSquarePlus size={15} color="var(--text-primary)" strokeWidth={1.8} />
                    </div>
                    <div className="w-7 h-11 flex items-center justify-center flex-shrink-0 mr-2" style={{ opacity: 0.4 }} title="Call">
                      <Phone size={15} color="var(--text-primary)" strokeWidth={1.8} />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Contributor (new) — ember context only, owners only */}
      {context.kind === 'ember' && context.canManage && (
        <div className="flex justify-end pt-1">
          <Link
            href={context.addNewHref}
            className="w-1/2 flex items-center justify-center gap-2 rounded-full px-5 text-white text-sm font-medium can-hover-dim"
            style={{ background: '#f97316', minHeight: 44 }}
          >
            Add Contributor
          </Link>
        </div>
      )}
    </div>
  );
}
