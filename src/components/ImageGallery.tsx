'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

const MOBILE_PAGE_SIZE = 9;

export default function ImageGallery() {
  const [images, setImages] = useState<FeedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobilePage, setMobilePage] = useState(1);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);

    syncViewport();

    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  const sortedImages = useMemo(
    () =>
      [...images].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
    [images]
  );

  const totalMobilePages = Math.max(1, Math.ceil(sortedImages.length / MOBILE_PAGE_SIZE));

  const effectiveMobilePage = isMobileViewport
    ? Math.min(mobilePage, totalMobilePages)
    : 1;

  const visibleImages = useMemo(() => {
    if (!isMobileViewport) {
      return sortedImages;
    }

    const start = (effectiveMobilePage - 1) * MOBILE_PAGE_SIZE;
    return sortedImages.slice(start, start + MOBILE_PAGE_SIZE);
  }, [effectiveMobilePage, isMobileViewport, sortedImages]);

  if (loading) {
    return <div className="py-16 text-center text-[var(--ember-muted)]">Loading your Embers...</div>;
  }

  if (error) {
    return <div className="ember-status ember-status-error">{error}</div>;
  }

  if (!sortedImages.length) {
    return (
      <section>
        <div className="mb-5">
          <p className="ember-eyebrow">Your Embers</p>
        </div>
        <div className="ember-panel rounded-[2rem] px-8 py-16 text-center text-[var(--ember-muted)]">
          Your feed is empty. Create your first Ember to see it here.
        </div>
      </section>
    );
  }

  return (
    <section className="pb-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="ember-eyebrow">Your Embers</p>
        </div>

        <div className="inline-flex rounded-full border border-[var(--ember-line)] p-1 text-sm font-medium text-[var(--ember-muted)]">
          <button
            type="button"
            onClick={() => setLayoutMode('grid')}
            className={`rounded-full px-4 py-2 transition ${
              layoutMode === 'grid'
                ? 'bg-[var(--ember-orange)] text-white'
                : 'text-[var(--ember-muted)] hover:text-[var(--ember-text)]'
            }`}
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode('list')}
            className={`rounded-full px-4 py-2 transition ${
              layoutMode === 'list'
                ? 'bg-[var(--ember-orange)] text-white'
                : 'text-[var(--ember-muted)] hover:text-[var(--ember-text)]'
            }`}
          >
            In order
          </button>
        </div>
      </div>

      <div
        className={
          layoutMode === 'grid'
            ? 'grid grid-cols-3 gap-3 sm:gap-5'
            : 'grid gap-5'
        }
      >
        {visibleImages.map((image) => {
          const title = getEmberTitle(image);

          return (
            <article
              key={image.id}
              className={`overflow-hidden rounded-[1.4rem] transition hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(17,17,17,0.08)] sm:rounded-[2rem] ${
                layoutMode === 'list' ? 'ember-panel p-4' : ''
              }`}
            >
              <Link
                href={`/image/${image.id}`}
                className="group block overflow-hidden rounded-[1.15rem] sm:rounded-[1.6rem]"
              >
                <div className="relative overflow-hidden rounded-[1.15rem] sm:rounded-[1.6rem]">
                  <MediaPreview
                    mediaType={image.mediaType}
                    filename={image.filename}
                    posterFilename={image.posterFilename}
                    originalName={title}
                    usePosterForVideo
                    className={`w-full object-cover ${
                      layoutMode === 'list' ? 'h-[19rem] sm:h-[24rem]' : 'h-32 sm:h-64'
                    }`}
                  />

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(17,17,17,0.82)] via-[rgba(17,17,17,0.42)] to-transparent px-2 py-2 sm:px-5 sm:py-5">
                    <h2 className="line-clamp-2 text-[0.72rem] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-2xl">
                      {title}
                    </h2>
                  </div>
                </div>
              </Link>
            </article>
          );
        })}
      </div>

      {isMobileViewport && totalMobilePages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-[1.5rem] border border-[var(--ember-line)] bg-white/84 px-4 py-3">
          <button
            type="button"
            onClick={() => setMobilePage((current) => Math.max(1, current - 1))}
            disabled={effectiveMobilePage === 1}
            className="rounded-full border border-[var(--ember-line)] px-4 py-2 text-sm font-medium text-[var(--ember-text)] disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-[var(--ember-muted)]">
            Page {effectiveMobilePage} of {totalMobilePages}
          </span>
          <button
            type="button"
            onClick={() =>
              setMobilePage((current) => Math.min(totalMobilePages, current + 1))
            }
            disabled={effectiveMobilePage === totalMobilePages}
            className="rounded-full border border-[var(--ember-line)] px-4 py-2 text-sm font-medium text-[var(--ember-text)] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
