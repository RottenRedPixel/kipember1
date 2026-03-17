'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type JSX } from 'react';
import MediaPreview from '@/components/MediaPreview';

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

type IconProps = {
  className?: string;
};

type CardAction = {
  key: 'ask' | 'play' | 'contributors' | 'shape';
  label: string;
  href: (image: FeedImage) => string;
  icon: (props: IconProps) => JSX.Element;
};

function HomeIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4.5 10.5 12 4l7.5 6.5" />
      <path d="M6.5 9.5V20h11V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

function ShareIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 4v10" />
      <path d="m8 8 4-4 4 4" />
      <path d="M5 13.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4.5" />
    </svg>
  );
}

function DiamondIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="m12 3.5 7.5 8.5L12 20.5 4.5 12 12 3.5Z" />
    </svg>
  );
}

function PlayIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="m8 5.75 10 6.25L8 18.25V5.75Z" />
    </svg>
  );
}

function PersonIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 12.25a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
      <path d="M5 19.25c1.35-2.8 3.78-4.25 7-4.25s5.65 1.45 7 4.25" />
    </svg>
  );
}

function CircleIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="7.25" />
    </svg>
  );
}

const cardActions: CardAction[] = [
  {
    key: 'ask',
    label: 'Ask Ember',
    href: (image) => `/image/${image.id}/chat`,
    icon: DiamondIcon,
  },
  {
    key: 'play',
    label: 'Play Ember',
    href: (image) => `/image/${image.id}/story-circle`,
    icon: PlayIcon,
  },
  {
    key: 'contributors',
    label: 'Contributors',
    href: (image) => `/image/${image.id}`,
    icon: PersonIcon,
  },
  {
    key: 'shape',
    label: 'Shape Ember',
    href: (image) => `/image/${image.id}/wiki`,
    icon: CircleIcon,
  },
];

const surfaceButtonClass =
  'flex h-11 w-11 items-center justify-center rounded-full border border-[var(--ember-line)] bg-white text-[var(--ember-text)] shadow-[0_10px_24px_rgba(17,17,17,0.06)] transition hover:border-[rgba(255,102,33,0.24)] hover:bg-[rgba(255,102,33,0.06)]';

const cardActionClass =
  'flex h-12 items-center justify-center rounded-full border border-[var(--ember-line)] bg-white text-[var(--ember-text)] transition hover:border-[rgba(255,102,33,0.24)] hover:bg-[rgba(255,102,33,0.06)]';

async function shareEmberLink(image: FeedImage) {
  const url = `${window.location.origin}/image/${image.id}`;

  if (navigator.share) {
    await navigator.share({
      title: image.originalName,
      text: 'Open this Ember',
      url,
    });
    return 'Share sheet opened.';
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return 'Ember link copied.';
  }

  throw new Error('Sharing is not available on this device.');
}

export default function ImageGallery() {
  const [images, setImages] = useState<FeedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

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

  useEffect(() => {
    if (!shareFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => setShareFeedback(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [shareFeedback]);

  const activeImage =
    sortedImages.find((image) => image.id === activeImageId) || sortedImages[0] || null;

  const handleShare = async (image: FeedImage) => {
    setActiveImageId(image.id);

    try {
      const text = await shareEmberLink(image);
      setShareFeedback({ type: 'success', text });
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') {
        return;
      }

      setShareFeedback({
        type: 'error',
        text:
          shareError instanceof Error ? shareError.message : 'Failed to share this Ember.',
      });
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-[var(--ember-muted)]">Loading your Ember feed...</div>;
  }

  if (error) {
    return <div className="ember-status ember-status-error">{error}</div>;
  }

  if (!sortedImages.length) {
    return (
      <section>
        <div className="mb-5">
          <p className="ember-eyebrow">Your Embers</p>
          <h2 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">Embers</h2>
        </div>
        <div className="ember-panel rounded-[2rem] px-8 py-16 text-center text-[var(--ember-muted)]">
          Your feed is empty. Add a photo or video above to create your first Ember.
        </div>
      </section>
    );
  }

  return (
    <section className="pb-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="ember-eyebrow">Your Embers</p>
          <h2 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">Embers</h2>
        </div>
        <p className="hidden text-sm text-[var(--ember-muted)] md:block">
          Home, share, ask, play, contributors, and shape each Ember from the card.
        </p>
      </div>

      {shareFeedback && (
        <div
          className={`mb-4 ember-status ${
            shareFeedback.type === 'error' ? 'ember-status-error' : 'ember-status-success'
          }`}
        >
          {shareFeedback.text}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {sortedImages.map((image) => (
          <article
            key={image.id}
            className={`ember-panel overflow-hidden rounded-[2rem] p-4 transition ${
              activeImage?.id === image.id
                ? 'border-[rgba(255,102,33,0.24)] shadow-[0_22px_50px_rgba(17,17,17,0.1)]'
                : 'hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(17,17,17,0.08)]'
            }`}
            onMouseEnter={() => setActiveImageId(image.id)}
            onFocus={() => setActiveImageId(image.id)}
            onTouchStart={() => setActiveImageId(image.id)}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <Link
                href={`/image/${image.id}`}
                className={surfaceButtonClass}
                aria-label={`Open ${image.originalName}`}
                onClick={() => setActiveImageId(image.id)}
              >
                <HomeIcon />
              </Link>
              <button
                type="button"
                onClick={() => void handleShare(image)}
                className={surfaceButtonClass}
                aria-label={`Share ${image.originalName}`}
              >
                <ShareIcon />
              </button>
            </div>

            <Link
              href={`/image/${image.id}`}
              className="block overflow-hidden rounded-[1.6rem]"
              onClick={() => setActiveImageId(image.id)}
            >
              <MediaPreview
                mediaType={image.mediaType}
                filename={image.filename}
                posterFilename={image.posterFilename}
                originalName={image.originalName}
                usePosterForVideo
                className="h-64 w-full object-cover"
              />
            </Link>

            <h3 className="ember-heading mt-4 break-all text-xl leading-tight text-[var(--ember-text)] sm:break-words sm:text-2xl sm:[overflow-wrap:anywhere]">
              {image.originalName}
            </h3>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {cardActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Link
                    key={action.key}
                    href={action.href(image)}
                    className={cardActionClass}
                    aria-label={action.label}
                    onClick={() => setActiveImageId(image.id)}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="sr-only">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </article>
        ))}
      </div>

    </section>
  );
}
