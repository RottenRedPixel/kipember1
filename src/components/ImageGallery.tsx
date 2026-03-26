'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getEmberTitle } from '@/lib/ember-title';
import MediaPreview from '@/components/MediaPreview';

type FeedImage = {
  id: string;
  filename: string;
  mediaType: 'IMAGE' | 'VIDEO';
  posterFilename: string | null;
  durationSeconds: number | null;
  originalName: string;
  title: string | null;
  description: string | null;
  createdAt: string;
  shareToNetwork: boolean;
  accessType: 'owner' | 'contributor' | 'network';
  owner: {
    id: string;
    name: string | null;
    email: string;
  };
  _count: {
    contributors: number;
    tags: number;
  };
  wiki: { id: string } | null;
};

const LOAD_BATCH_SIZE = 15;

function GridViewIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListViewIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="3" y="5" width="18" height="2" rx="1" />
      <rect x="3" y="11" width="18" height="2" rx="1" />
      <rect x="3" y="17" width="18" height="2" rx="1" />
    </svg>
  );
}

export default function ImageGallery() {
  const [images, setImages] = useState<FeedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [visibleCount, setVisibleCount] = useState(LOAD_BATCH_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/images')
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load feed');
        }
        setImages(payload);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load feed'))
      .finally(() => setLoading(false));
  }, []);

  const sortedImages = useMemo(
    () =>
      [...images].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
    [images]
  );

  const effectiveVisibleCount = sortedImages.length
    ? Math.min(Math.max(visibleCount, LOAD_BATCH_SIZE), sortedImages.length)
    : LOAD_BATCH_SIZE;

  useEffect(() => {
    if (!loadMoreRef.current || effectiveVisibleCount >= sortedImages.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          return;
        }

        setVisibleCount((current) =>
          Math.min(current + LOAD_BATCH_SIZE, sortedImages.length)
        );
      },
      {
        rootMargin: '240px 0px',
      }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [effectiveVisibleCount, sortedImages.length]);

  const visibleImages = useMemo(
    () => sortedImages.slice(0, effectiveVisibleCount),
    [effectiveVisibleCount, sortedImages]
  );

  if (loading) {
    return <div className="py-12 text-center text-[var(--ember-muted)]">Loading your Embers...</div>;
  }

  if (error) {
    return <div className="ember-status ember-status-error">{error}</div>;
  }

  if (!sortedImages.length) {
    return (
      <section className="pb-6">
        <div className="mb-3 inline-flex items-center rounded-full border border-[var(--ember-line)] px-4 py-2 text-sm font-medium text-[var(--ember-text)]">
          Your Embers
        </div>
        <div className="ember-panel rounded-[1.6rem] px-6 py-14 text-center text-[var(--ember-muted)] sm:rounded-[2rem] sm:px-8">
          Your feed is empty. Create your first Ember to see it here.
        </div>
      </section>
    );
  }

  return (
    <section className="pb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-full border border-[var(--ember-line)] px-4 py-2 text-sm font-medium text-[var(--ember-text)]">
          Your Embers
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border border-[var(--ember-line)] p-1 text-[var(--ember-muted)]">
          <button
            type="button"
            onClick={() => setLayoutMode('grid')}
            aria-label="Grid view"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
              layoutMode === 'grid'
                ? 'bg-[var(--ember-orange-soft)] text-[var(--ember-orange)]'
                : 'text-[var(--ember-muted)] hover:text-[var(--ember-text)]'
            }`}
          >
            <GridViewIcon />
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode('list')}
            aria-label="List view"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
              layoutMode === 'list'
                ? 'bg-[var(--ember-orange-soft)] text-[var(--ember-orange)]'
                : 'text-[var(--ember-muted)] hover:text-[var(--ember-text)]'
            }`}
          >
            <ListViewIcon />
          </button>
        </div>
      </div>

      <div className={layoutMode === 'grid' ? 'grid grid-cols-3 gap-2 sm:gap-3' : 'grid gap-3'}>
        {visibleImages.map((image) => {
          const title = getEmberTitle(image);

          return (
              <article
                key={image.id}
                className={`overflow-hidden ember-photo-shell transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(17,17,17,0.08)] ${
                  layoutMode === 'list' ? 'ember-panel p-2 sm:p-3' : ''
                }`}
              >
                <Link
                  href={`/image/${image.id}`}
                  className="group block overflow-hidden ember-photo-shell"
                >
                  <div className="relative overflow-hidden ember-photo-shell">
                    <MediaPreview
                      mediaType={image.mediaType}
                      filename={image.filename}
                    posterFilename={image.posterFilename}
                    originalName={title}
                    usePosterForVideo
                    className={`w-full object-cover ${
                      layoutMode === 'list' ? 'h-[15rem] sm:h-[21rem]' : 'aspect-[0.82] h-auto'
                    }`}
                  />

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(17,17,17,0.94)] via-[rgba(17,17,17,0.58)] to-transparent px-1.5 py-1.5 sm:px-4 sm:py-4">
                    <h2
                      className={`rounded-[0.75rem] bg-[rgba(17,17,17,0.38)] px-1.5 py-1 text-[0.8rem] font-semibold leading-[1.12] tracking-[-0.02em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] sm:rounded-[1rem] sm:px-3 sm:py-2 ${
                        layoutMode === 'list'
                          ? 'line-clamp-none text-base sm:text-xl'
                          : 'line-clamp-3 sm:line-clamp-2 sm:text-lg'
                      }`}
                    >
                      {title}
                    </h2>
                  </div>
                </div>
              </Link>
            </article>
          );
        })}
      </div>

      {effectiveVisibleCount < sortedImages.length && (
        <div ref={loadMoreRef} className="mt-3 py-3 text-center text-sm text-[var(--ember-muted)]">
          Loading more Embers...
        </div>
      )}
    </section>
  );
}
