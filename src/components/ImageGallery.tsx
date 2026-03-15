'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import MediaPreview from '@/components/MediaPreview';
import { formatDuration } from '@/lib/media';

type FeedImage = {
  id: string;
  filename: string;
  mediaType: 'IMAGE' | 'VIDEO';
  posterFilename: string | null;
  durationSeconds: number | null;
  originalName: string;
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

function Section({
  title,
  description,
  images,
}: {
  title: string;
  description: string;
  images: FeedImage[];
}) {
  if (images.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {images.map((image) => (
          <Link
            key={image.id}
            href={`/image/${image.id}`}
            className="overflow-hidden rounded-[2rem] border border-white/90 bg-white/92 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="relative">
              <MediaPreview
                mediaType={image.mediaType}
                filename={image.filename}
                posterFilename={image.posterFilename}
                originalName={image.originalName}
                usePosterForVideo
                className="h-48 w-full object-cover"
              />
              {image.mediaType === 'VIDEO' && (
                <div className="absolute inset-x-0 top-3 flex items-center justify-between px-3">
                  <span className="rounded-full bg-black/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                    Video
                  </span>
                  {formatDuration(image.durationSeconds) && (
                    <span className="rounded-full bg-black/65 px-3 py-1 text-[11px] font-semibold text-white">
                      {formatDuration(image.durationSeconds)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="truncate text-lg font-semibold text-slate-950">
                  {image.originalName}
                </h3>
                {image.wiki && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    Wiki ready
                  </span>
                )}
              </div>
              {image.description && (
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                  {image.description}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <span>{image._count.contributors} contributors</span>
                <span>{image._count.tags} tags</span>
                {image.shareToNetwork && <span>Network shared</span>}
              </div>
              <p className="mt-4 text-sm text-slate-500">
                {image.accessType === 'owner'
                  ? 'Owned by you'
                  : image.accessType === 'contributor'
                    ? 'You are a contributor'
                    : `Shared by ${image.owner.name || image.owner.email}`}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function ImageGallery() {
  const [images, setImages] = useState<FeedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const grouped = useMemo(
    () => ({
      owned: images.filter((image) => image.accessType === 'owner'),
      contributing: images.filter((image) => image.accessType === 'contributor'),
      network: images.filter((image) => image.accessType === 'network'),
    }),
    [images]
  );

  if (loading) {
    return <div className="py-16 text-center text-slate-500">Loading your Ember feed...</div>;
  }

  if (error) {
    return (
      <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="mt-12 rounded-[2rem] border border-dashed border-slate-300 bg-white/80 px-8 py-16 text-center text-slate-500">
        Your feed is empty. Upload your first Ember above, then start inviting contributors and friends.
      </div>
    );
  }

  return (
    <div className="pb-12">
      <Section
        title="Your Embers"
        description="The photos you own and manage directly."
        images={grouped.owned}
      />
      <Section
        title="Embers you contribute to"
        description="Photos where someone has named you as a contributor."
        images={grouped.contributing}
      />
      <Section
        title="From your network"
        description="Friend-shared Embers that were posted to the network feed."
        images={grouped.network}
      />
    </div>
  );
}
