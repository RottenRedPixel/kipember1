'use client';

import Link from 'next/link';
import { LayoutGrid, List } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import MediaPreview from '@/components/MediaPreview';

type FeedImage = {
  id: string;
  filename: string;
  mediaType: 'IMAGE' | 'VIDEO';
  posterFilename: string | null;
  originalName: string;
  createdAt: string;
};

const LOAD_BATCH_SIZE = 15;

function formatCreatedAt(createdAt: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(createdAt));
  } catch {
    return '';
  }
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
      { rootMargin: '260px 0px' }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [effectiveVisibleCount, sortedImages.length]);

  const visibleImages = useMemo(
    () => sortedImages.slice(0, effectiveVisibleCount),
    [effectiveVisibleCount, sortedImages]
  );

  return (
    <section className="min-h-[calc(100vh-2.7rem)] bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.1),transparent_24%),linear-gradient(180deg,rgba(17,17,17,0.98)_0%,rgba(12,12,12,1)_100%)] px-4 pt-5 pb-6 text-white lg:px-6 lg:pt-6 lg:pb-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[36rem]">
            <span className="kip-pill">Embers</span>
            <h1 className="mt-4 text-[2.2rem] font-semibold leading-[0.96] tracking-[-0.06em] lg:text-[3.35rem]">
              Your memory library
            </h1>
            <p className="mt-2 max-w-[30rem] text-sm leading-7 text-[var(--kip-text-secondary)] lg:text-[0.98rem]">
              Open an Ember to continue the conversation, invite others into it, or play back the short version of the story.
            </p>
          </div>

          <div className="inline-flex self-start rounded-full border border-white/8 bg-white/5 p-1 text-white/52 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setLayoutMode('list')}
              aria-label="List view"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                layoutMode === 'list' ? 'bg-white/10 text-white' : ''
              }`}
            >
              <List className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('grid')}
              aria-label="Grid view"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                layoutMode === 'grid' ? 'bg-white/10 text-white' : ''
              }`}
            >
              <LayoutGrid className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className={`mt-6 ${layoutMode === 'grid' ? 'grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 lg:gap-3' : 'grid gap-3 lg:grid-cols-2'}`}>
            {Array.from({ length: layoutMode === 'grid' ? 12 : 4 }).map((_, index) => (
              <div
                key={index}
                className={layoutMode === 'grid'
                  ? 'aspect-square rounded-[1.15rem] border border-white/8 bg-white/6'
                  : 'aspect-[1.22] rounded-[1.35rem] border border-white/8 bg-white/6'}
              />
            ))}
          </div>
        ) : error ? (
          <div className="kip-surface mt-6 rounded-[1.45rem] px-4 py-4 text-sm text-white/72">{error}</div>
        ) : !visibleImages.length ? (
          <div className="kip-surface mt-6 rounded-[1.45rem] px-4 py-5 text-sm text-white/72">
            No Embers yet. Upload one from Create to start the archive.
          </div>
        ) : (
          <>
            <div className={`mt-6 ${layoutMode === 'grid' ? 'grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 lg:gap-3' : 'grid gap-3 lg:grid-cols-2 xl:grid-cols-3'}`}>
              {visibleImages.map((image) => (
                <Link
                  key={image.id}
                  href={`/image/${image.id}`}
                  className="kip-grid-tile group block"
                >
                  <div className="relative">
                    <MediaPreview
                      mediaType={image.mediaType}
                      filename={image.filename}
                      posterFilename={image.posterFilename}
                      originalName={image.originalName}
                      usePosterForVideo
                      className={layoutMode === 'grid'
                        ? 'aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.03]'
                        : 'aspect-[1.22] w-full object-cover transition duration-300 group-hover:scale-[1.02]'}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02),transparent_42%,rgba(0,0,0,0.76))]" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 py-3">
                      <div className="flex items-center justify-between gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/84">
                        <span>
                          {image.mediaType === 'VIDEO'
                            ? 'Video'
                            : layoutMode === 'list'
                              ? 'Photo'
                              : ''}
                        </span>
                        <span>{formatCreatedAt(image.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {effectiveVisibleCount < sortedImages.length && (
              <div ref={loadMoreRef} className="h-12" aria-hidden="true" />
            )}
          </>
        )}
      </div>
    </section>
  );
}
