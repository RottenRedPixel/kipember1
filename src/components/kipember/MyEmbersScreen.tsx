'use client';

import Link from 'next/link';
import { ChevronDown, Plus, FileStack } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import AppHeader from '@/components/kipember/AppHeader';
import type { EmberMediaType } from '@/lib/media';
import { getPreviewMediaUrl } from '@/lib/media';
import type { AccessibleImageSummary } from '@/lib/image-summaries';

type ImageSummary = AccessibleImageSummary & {
  mediaType: EmberMediaType;
  createdAt: string | Date;
};

const SORT_OPTIONS = ['Newest', 'Oldest', 'A-Z', 'Z-A'];

function sortEmbers(embers: ImageSummary[], sort: string) {
  return [...embers].sort((a, b) => {
    if (sort === 'A-Z') return (a.title || a.originalName).localeCompare(b.title || b.originalName);
    if (sort === 'Z-A') return (b.title || b.originalName).localeCompare(a.title || a.originalName);
    if (sort === 'Oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export default function MyEmbersScreen({
  initialImages = [],
  avatarUrl,
  userInitials,
}: {
  initialImages?: ImageSummary[];
  avatarUrl?: string | null;
  userInitials?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [images, setImages] = useState<ImageSummary[]>(initialImages);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileSelect(file: File) {
    setCreating(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/images', { method: 'POST', body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload?.id !== 'string') {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to create ember');
      }
      router.push(`/home?id=${payload.id}&ember=welcome`);
    } catch {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (initialImages.length > 0) return;
    void fetch('/api/images')
      .then(async (res) => {
        if (!res.ok) return;
        setImages((await res.json()) as ImageSummary[]);
      })
      .catch(() => undefined);
  }, [initialImages.length]);

  const view = searchParams.get('view') ?? 'mine';
  const sort = searchParams.get('sort') ?? 'Newest';
  const showSort = searchParams.get('sort-open') === '1';
  const isShared = view === 'shared';

  const buildHref = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) next.delete(key);
      else next.set(key, value);
    });
    const query = next.toString();
    return query ? `/user/my-embers?${query}` : '/user/my-embers';
  };

  const filtered = images.filter((img) =>
    isShared ? img.accessType !== 'owner' : img.accessType === 'owner'
  );
  const sorted = sortEmbers(filtered, sort);

  return (
    <div className="fixed inset-0" style={{ background: 'var(--bg-screen)' }}>
      <AppHeader avatarUrl={avatarUrl} userInitials={userInitials} userModalHref="/account" />

<div className="absolute left-0 right-0 bottom-0 flex flex-col items-center" style={{ top: 56 }}>
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
            <Link
              href="/home"
              className="flex items-center justify-center rounded-full can-hover-dim"
              style={{ width: 32, height: 32, background: '#f97316', flexShrink: 0 }}
              aria-label="Create new ember"
            >
              <Plus size={16} color="white" strokeWidth={2.5} />
            </Link>
          </div>

          {/* Sort dropdown */}
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

        {/* Grid */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center pt-4">
              <div
                className="flex flex-col items-center gap-4 rounded-2xl px-8 py-8 mx-4 text-center"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
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
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={creating}
                      className="w-full flex items-center justify-center rounded-full text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
                      style={{ background: '#f97316', minHeight: 44 }}
                    >
                      {creating ? 'Creating...' : 'Choose Photo'}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {sorted.map((image) => (
                <Link
                  key={image.id}
                  href={`/home?id=${image.id}`}
                  className="aspect-square rounded-xl overflow-hidden can-hover-card relative"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', opacity: 0.95 }}
                >
                  <img
                    src={getPreviewMediaUrl({
                      mediaType: image.mediaType,
                      filename: image.filename,
                      posterFilename: image.posterFilename,
                    })}
                    alt={image.title || image.originalName}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {image.photoCount > 1 ? (
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
    </div>
  );
}
