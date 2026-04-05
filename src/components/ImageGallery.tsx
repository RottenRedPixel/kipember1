'use client';

import Link from 'next/link';
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

function GridViewIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="3" y="3" width="5" height="5" />
      <rect x="10" y="3" width="5" height="5" />
      <rect x="17" y="3" width="5" height="5" />
      <rect x="3" y="10" width="5" height="5" />
      <rect x="10" y="10" width="5" height="5" />
      <rect x="17" y="10" width="5" height="5" />
      <rect x="3" y="17" width="5" height="5" />
      <rect x="10" y="17" width="5" height="5" />
      <rect x="17" y="17" width="5" height="5" />
    </svg>
  );
}

function ListViewIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="2" y="4" width="20" height="3.2" rx="0.8" />
      <rect x="2" y="10.4" width="20" height="3.2" rx="0.8" />
      <rect x="2" y="16.8" width="20" height="3.2" rx="0.8" />
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
    <section className="bg-white px-5 pt-7 pb-7">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-[1.08rem] font-semibold tracking-[-0.03em] text-black">My Embers</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLayoutMode('list')}
            aria-label="List view"
            className={layoutMode === 'list' ? 'text-black' : 'text-[#c9c9c9]'}
          >
            <ListViewIcon />
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode('grid')}
            aria-label="Grid view"
            className={layoutMode === 'grid' ? 'text-black' : 'text-[#c9c9c9]'}
          >
            <GridViewIcon />
          </button>
        </div>
      </div>

      {loading ? (
        <div className={layoutMode === 'grid' ? 'grid grid-cols-3 gap-2.5' : 'grid gap-2.5'}>
          {Array.from({ length: layoutMode === 'grid' ? 12 : 3 }).map((_, index) => (
            <div
              key={index}
              className={layoutMode === 'grid' ? 'aspect-square bg-[#d3d3d3]' : 'aspect-[1.22] bg-[#d3d3d3]'}
            />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-[#8f8f8f]">{error}</div>
      ) : !visibleImages.length ? (
        <div className="text-sm text-[#8f8f8f]">No embers yet.</div>
      ) : (
        <>
          <div className={layoutMode === 'grid' ? 'grid grid-cols-3 gap-2.5' : 'grid gap-2.5'}>
            {visibleImages.map((image) => (
              <Link key={image.id} href={`/image/${image.id}`} className="block overflow-hidden bg-[#d3d3d3]">
                <MediaPreview
                  mediaType={image.mediaType}
                  filename={image.filename}
                  posterFilename={image.posterFilename}
                  originalName={image.originalName}
                  usePosterForVideo
                  className={layoutMode === 'grid' ? 'aspect-square w-full object-cover' : 'aspect-[1.22] w-full object-cover'}
                />
              </Link>
            ))}
          </div>

          {effectiveVisibleCount < sortedImages.length && (
            <div ref={loadMoreRef} className="h-12" aria-hidden="true" />
          )}
        </>
      )}
    </section>
  );
}
