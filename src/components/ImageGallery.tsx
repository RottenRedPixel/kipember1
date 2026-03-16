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
        <h2 className="ember-heading text-3xl text-[var(--ember-text)]">{title}</h2>
        <p className="ember-copy mt-2 text-sm">{description}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {images.map((image) => (
          <Link
            key={image.id}
            href={`/image/${image.id}`}
            className="ember-panel overflow-hidden rounded-[2rem] transition hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(17,17,17,0.08)]"
          >
            <div className="relative">
              <MediaPreview
                mediaType={image.mediaType}
                filename={image.filename}
                posterFilename={image.posterFilename}
                originalName={image.originalName}
                usePosterForVideo
                className="h-56 w-full object-cover"
              />
              <div className="absolute inset-x-0 top-3 flex items-center justify-between px-3">
                <span className="ember-chip border-0 bg-black/60 text-white">
                  {image.mediaType === 'VIDEO' ? 'Video' : 'Photo'}
                </span>
                {image.mediaType === 'VIDEO' && formatDuration(image.durationSeconds) && (
                  <span className="ember-chip border-0 bg-black/60 text-white">
                    {formatDuration(image.durationSeconds)}
                  </span>
                )}
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="ember-eyebrow">
                    {image.accessType === 'owner'
                      ? 'Owner Ember'
                      : image.accessType === 'contributor'
                        ? 'Contributor Ember'
                        : 'Network Ember'}
                  </p>
                  <h3 className="ember-heading mt-2 break-words text-2xl text-[var(--ember-text)] [overflow-wrap:anywhere]">
                    {image.originalName}
                  </h3>
                </div>
                {image.wiki && (
                  <span className="ember-chip text-[var(--ember-orange-deep)]">Wiki ready</span>
                )}
              </div>
              {image.description && (
                <p className="ember-copy mt-3 line-clamp-3 text-sm">{image.description}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="ember-chip">{image._count.contributors} contributors</span>
                <span className="ember-chip">{image._count.tags} tags</span>
                {image.shareToNetwork && <span className="ember-chip">Shared</span>}
              </div>
              <p className="mt-4 text-sm text-[var(--ember-muted)]">
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
    return <div className="py-16 text-center text-[var(--ember-muted)]">Loading your Ember feed...</div>;
  }

  if (error) {
    return <div className="ember-status ember-status-error mt-8">{error}</div>;
  }

  if (images.length === 0) {
    return (
      <div className="ember-panel mt-12 rounded-[2rem] px-8 py-16 text-center text-[var(--ember-muted)]">
        Your feed is empty. Upload your first Ember above, then start inviting contributors and friends.
      </div>
    );
  }

  return (
    <div className="pb-12">
      <Section
        title="Your Embers"
        description="The memories you own and manage directly."
        images={grouped.owned}
      />
      <Section
        title="Embers you contribute to"
        description="Photos and videos where someone invited you into the memory."
        images={grouped.contributing}
      />
      <Section
        title="From your network"
        description="Shared Embers that were published into your trusted network."
        images={grouped.network}
      />
    </div>
  );
}
