'use client';

import Link from 'next/link';
import { ChevronDown, Plus, FileStack, LayoutGrid, LayoutList, Users, BookOpen } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import AppHeader from '@/components/kipember/AppHeader';
import EmberCreateFlow from '@/components/kipember/EmberCreateFlow';
import KipemberAccountOverlay from '@/components/kipember/KipemberAccountOverlay';
import type { EmberMediaType } from '@/lib/media';
import { getPreviewMediaUrl } from '@/lib/media';
import type { EmberSummary as BaseEmberSummary } from '@/lib/ember';

type EmberSummary = BaseEmberSummary & {
  mediaType: EmberMediaType;
  createdAt: string | Date;
};

const SORT_OPTIONS = ['Newest', 'Oldest', 'A-Z', 'Z-A'];

function sortEmbers(embers: EmberSummary[], sort: string) {
  return [...embers].sort((a, b) => {
    if (sort === 'A-Z') return (a.title || a.originalName).localeCompare(b.title || b.originalName);
    if (sort === 'Z-A') return (b.title || b.originalName).localeCompare(a.title || a.originalName);
    if (sort === 'Oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export default function MyEmbersScreen({
  initialEmbers = [],
  avatarUrl,
  userInitials,
}: {
  initialEmbers?: EmberSummary[];
  avatarUrl?: string | null;
  userInitials?: string;
}) {
  const searchParams = useSearchParams();
  const modal = searchParams.get('m');
  // Account modal — clicking the avatar appends ?m=account to the
  // current URL so the overlay opens in-place over /embers.
  const accountOpenHref = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('m', 'account');
    const query = next.toString();
    return query ? `/embers?${query}` : '/embers';
  }, [searchParams]);
  const accountCloseHref = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('m');
    const query = next.toString();
    return query ? `/embers?${query}` : '/embers';
  }, [searchParams]);
  const [embers, setEmbers] = useState<EmberSummary[]>(initialEmbers);
  const [createFile, setCreateFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileSelect(file: File) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;
    setCreateFile(file);
  }

  useEffect(() => {
    if (initialEmbers.length > 0) return;
    void fetch('/api/images')
      .then(async (res) => {
        if (!res.ok) return;
        setEmbers((await res.json()) as EmberSummary[]);
      })
      .catch(() => undefined);
  }, [initialEmbers.length]);

  const view = searchParams.get('view') ?? 'mine';
  const sort = searchParams.get('sort') ?? 'Newest';
  const showSort = searchParams.get('sort-open') === '1';
  const isShared = view === 'shared';

  const [isRowLayout, setIsRowLayout] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('embers-layout') === 'row';
  });

  function setLayout(row: boolean) {
    setIsRowLayout(row);
    localStorage.setItem('embers-layout', row ? 'row' : 'grid');
  }

  const buildHref = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) next.delete(key);
      else next.set(key, value);
    });
    const query = next.toString();
    return query ? `/embers?${query}` : '/embers';
  };

  const filtered = embers.filter((ember) =>
    isShared ? ember.accessType !== 'owner' : ember.accessType === 'owner'
  );
  const sorted = sortEmbers(filtered, sort);

  if (createFile) {
    return (
      <EmberCreateFlow
        file={createFile}
        avatarUrl={avatarUrl}
        userInitials={userInitials}
        onCancel={() => setCreateFile(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0" style={{ background: 'var(--bg-screen)' }}>
      <AppHeader avatarUrl={avatarUrl} userInitials={userInitials} userModalHref={accountOpenHref} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = '';
          if (file) void handleFileSelect(file);
        }}
      />

<div className="absolute left-0 right-0 bottom-0 flex flex-col items-center fade-in" style={{ top: 56 }}>
      <div className="flex flex-col w-full max-w-xl flex-1 min-h-0">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">

          {/* View toggle + create button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--bg-surface)' }}>
              <Link
                href={buildHref({ view: null, 'sort-open': null })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: !isShared ? 'var(--bg-screen)' : 'transparent',
                  color: !isShared ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                Mine
              </Link>
              <Link
                href={buildHref({ view: 'shared', 'sort-open': null })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: isShared ? 'var(--bg-screen)' : 'transparent',
                  color: isShared ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                Shared
              </Link>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center rounded-full can-hover-dim cursor-pointer"
              style={{ width: 32, height: 32, background: '#f97316', flexShrink: 0 }}
              aria-label="Create new ember"
            >
              <Plus size={16} color="white" strokeWidth={2.5} />
            </button>
          </div>

          {/* Layout toggle + Sort dropdown */}
          <div className="flex items-center gap-2">
            {/* Layout toggle */}
            <div className="flex items-center gap-0.5 rounded-xl p-1" style={{ background: 'var(--bg-surface)' }}>
              <button
                type="button"
                onClick={() => setLayout(false)}
                className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors cursor-pointer"
                style={{ background: !isRowLayout ? 'var(--bg-screen)' : 'transparent' }}
                aria-label="Grid view"
              >
                <LayoutGrid size={14} color={!isRowLayout ? '#ffffff' : 'var(--text-secondary)'} />
              </button>
              <button
                type="button"
                onClick={() => setLayout(true)}
                className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors cursor-pointer"
                style={{ background: isRowLayout ? 'var(--bg-screen)' : 'transparent' }}
                aria-label="Row view"
              >
                <LayoutList size={14} color={isRowLayout ? '#ffffff' : 'var(--text-secondary)'} />
              </button>
            </div>

          <div className="relative">
            <Link
              href={buildHref({ 'sort-open': showSort ? '0' : '1' })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl can-hover"
              style={{ background: 'var(--bg-surface)', opacity: 0.9 }}
            >
              <span className="text-white text-xs font-medium">{sort}</span>
              <ChevronDown size={13} color="var(--text-secondary)" strokeWidth={2} />
            </Link>
            {showSort ? (
              <div
                className="absolute top-full right-0 mt-1 rounded-xl overflow-hidden z-10 flex flex-col"
                style={{ background: 'var(--bg-screen)', border: '1px solid var(--border-default)', minWidth: 110 }}
              >
                {SORT_OPTIONS.map((option) => (
                  <Link
                    key={option}
                    href={buildHref({ sort: option, 'sort-open': '0' })}
                    className="px-4 py-2.5 text-xs font-medium can-hover"
                    style={{ color: option === sort ? '#f97316' : 'var(--text-primary)', opacity: 0.9 }}
                  >
                    {option}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center pt-4">
              <div
                className="flex flex-col items-center gap-4 rounded-2xl px-8 py-8 mx-4 text-center"
                style={{ background: 'var(--bg-screen)', border: '1px solid var(--border-subtle)' }}
              >
                <svg width="48" height="48" viewBox="0 0 72 72" fill="white">
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
                <div className="flex flex-col gap-2">
                  <p className="text-white font-semibold text-base">
                    {isShared ? 'No shared embers yet.' : 'Create your first ember'}
                  </p>
                  {!isShared ? (
                    <p className="text-white/50 text-sm leading-relaxed">
                      Let&apos;s start with a photo that will help build this memory into a glowing ember.
                    </p>
                  ) : null}
                </div>
                {!isShared ? (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center rounded-full text-white text-sm font-semibold cursor-pointer"
                      style={{ background: '#f97316', minHeight: 44 }}
                    >
                      Choose Photo
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : isRowLayout ? (
            <div className="flex flex-col gap-2">
              {sorted.map((ember) => {
                const completenessScore = [
                  Boolean(ember.title),
                  Boolean(ember.description),
                  Boolean(ember.capturedAt),
                  ember.hasLocation,
                  ember.contributorCount > 0,
                  ember.hasVoiceCall,
                  ember.hasWiki,
                ].filter(Boolean).length;
                const completenessPercent = (completenessScore / 7) * 100;
                const displayDate = ember.capturedAt ?? ember.createdAt;
                return (
                  <Link
                    key={ember.id}
                    href={`/ember/${ember.id}`}
                    className="flex rounded-xl overflow-hidden can-hover-card"
                    style={{ background: 'var(--bg-screen)', border: '1px solid var(--border-default)' }}
                  >
                    {/* Photo */}
                    <div className="relative flex-shrink-0" style={{ width: 177, height: 177 }}>
                      <img
                        src={getPreviewMediaUrl({
                          mediaType: ember.mediaType,
                          filename: ember.filename,
                          posterFilename: ember.posterFilename,
                        })}
                        alt={ember.title || ember.originalName}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      {ember.photoCount > 1 ? (
                        <div className="absolute top-1.5 right-1.5">
                          <FileStack size={13} className="text-white drop-shadow-md" />
                        </div>
                      ) : null}
                    </div>

                    {/* Info */}
                    <div className="flex flex-col justify-between flex-1 min-w-0 px-3 py-2.5">
                      {/* Title + date */}
                      <div>
                        <p className="text-white text-sm font-medium leading-snug truncate">
                          {ember.title || ember.originalName}
                        </p>
                        <p className="text-white/40 text-xs mt-0.5">
                          {new Date(displayDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>

                      {/* Contributors + wiki completeness */}
                      <div className="flex items-center gap-3 mt-2">
                        {/* Contributor count */}
                        <div className="flex items-center gap-1">
                          <Users size={12} style={{ color: ember.contributorCount > 0 ? '#f97316' : 'var(--text-secondary)' }} />
                          <span className="text-xs" style={{ color: ember.contributorCount > 0 ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)' }}>
                            {ember.contributorCount}
                          </span>
                        </div>

                        {/* Wiki completeness bar */}
                        <div className="flex items-center gap-1.5 flex-1">
                          <BookOpen size={12} style={{ color: ember.hasWiki ? '#f97316' : 'var(--text-secondary)', flexShrink: 0 }} />
                          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.08)' }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${completenessPercent}%`,
                                background: completenessPercent === 100
                                  ? '#f97316'
                                  : completenessPercent >= 60
                                    ? 'rgba(249,115,22,0.6)'
                                    : 'rgba(255,255,255,0.25)',
                              }}
                            />
                          </div>
                          <span className="text-white/30 text-[10px] flex-shrink-0">{completenessScore}/7</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {sorted.map((ember) => (
                <Link
                  key={ember.id}
                  href={`/ember/${ember.id}`}
                  className="aspect-square rounded-xl overflow-hidden can-hover-card relative"
                  style={{ background: 'var(--bg-screen)', border: '1px solid var(--border-default)', opacity: 0.95 }}
                >
                  <img
                    src={getPreviewMediaUrl({
                      mediaType: ember.mediaType,
                      filename: ember.filename,
                      posterFilename: ember.posterFilename,
                    })}
                    alt={ember.title || ember.originalName}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {ember.photoCount > 1 ? (
                    <div className="absolute top-1.5 right-1.5 z-10">
                      <FileStack size={16} className="text-white drop-shadow-md" />
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>

      {modal === 'account' ? (
        <KipemberAccountOverlay closeHref={accountCloseHref} />
      ) : null}
    </div>
  );
}
