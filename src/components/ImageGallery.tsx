'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
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

type IconProps = {
  className?: string;
};

const MOBILE_PAGE_SIZE = 5;

function DiamondIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
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

function CircleIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="12" r="7.25" />
    </svg>
  );
}

function CloseIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

type CardAction = {
  key: 'ask' | 'play';
  label: string;
  href: (image: FeedImage) => string;
  icon: (props: IconProps) => JSX.Element;
};

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
    href: (image) => `/image/${image.id}/wiki`,
    icon: PlayIcon,
  },
];

const cardActionClass =
  'flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--ember-orange-deep)] bg-[var(--ember-orange)] px-4 text-white transition hover:border-[var(--ember-orange-deep)] hover:bg-[var(--ember-orange-deep)]';

async function shareEmberLink(image: FeedImage) {
  const url = `${window.location.origin}/image/${image.id}`;
  const displayTitle = getEmberTitle(image);

  if (navigator.share) {
    await navigator.share({
      title: displayTitle,
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
  const router = useRouter();
  const [images, setImages] = useState<FeedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shapeMenuImageId, setShapeMenuImageId] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobilePage, setMobilePage] = useState(1);

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

  useEffect(() => {
    if (!isMobileViewport) {
      setMobilePage(1);
      return;
    }

    setMobilePage((current) => Math.min(current, totalMobilePages));
  }, [isMobileViewport, totalMobilePages]);

  useEffect(() => {
    if (!shareFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => setShareFeedback(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [shareFeedback]);

  const visibleImages = useMemo(() => {
    if (!isMobileViewport) {
      return sortedImages;
    }

    const start = (mobilePage - 1) * MOBILE_PAGE_SIZE;
    return sortedImages.slice(start, start + MOBILE_PAGE_SIZE);
  }, [isMobileViewport, mobilePage, sortedImages]);

  const shapeMenuImage =
    sortedImages.find((image) => image.id === shapeMenuImageId) || null;

  const handleShare = async (image: FeedImage) => {
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

  const openShapeRoute = (href: string) => {
    setShapeMenuImageId(null);
    router.push(href);
  };

  const handleDelete = async (image: FeedImage) => {
    if (image.accessType !== 'owner' || deletingImageId) {
      return;
    }

    const displayTitle = getEmberTitle(image);
    const confirmed = window.confirm(`Delete ${displayTitle}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeletingImageId(image.id);

    try {
      const response = await fetch(`/api/images/${image.id}`, {
        method: 'DELETE',
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete Ember');
      }

      setImages((current) => current.filter((item) => item.id !== image.id));
      setShapeMenuImageId(null);
      setShareFeedback({ type: 'success', text: 'Ember deleted.' });
    } catch (deleteError) {
      setShareFeedback({
        type: 'error',
        text:
          deleteError instanceof Error ? deleteError.message : 'Failed to delete Ember.',
      });
    } finally {
      setDeletingImageId(null);
    }
  };

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
        </div>
        <p className="hidden text-sm text-[var(--ember-muted)] md:block">
          Ask, play, or tend each Ember from the card.
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
        {visibleImages.map((image) => {
          return (
            <article
              key={image.id}
              className="ember-panel overflow-hidden rounded-[2rem] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(17,17,17,0.08)]"
            >
              <Link href={`/image/${image.id}`} className="block overflow-hidden rounded-[1.6rem]">
                <MediaPreview
                  mediaType={image.mediaType}
                  filename={image.filename}
                  posterFilename={image.posterFilename}
                  originalName={getEmberTitle(image)}
                  usePosterForVideo
                  className="h-64 w-full object-cover"
                />
              </Link>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {cardActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <Link
                      key={action.key}
                      href={action.href(image)}
                      className={cardActionClass}
                      aria-label={action.label}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-medium">{action.label}</span>
                    </Link>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setShapeMenuImageId(image.id)}
                  className={cardActionClass}
                  aria-label="Tend Ember"
                >
                  <CircleIcon className="h-5 w-5" />
                  <span className="text-sm font-medium">Tend Ember</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {isMobileViewport && totalMobilePages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-[1.5rem] border border-[var(--ember-line)] bg-white/84 px-4 py-3">
          <button
            type="button"
            onClick={() => setMobilePage((current) => Math.max(1, current - 1))}
            disabled={mobilePage === 1}
            className="rounded-full border border-[var(--ember-line)] px-4 py-2 text-sm font-medium text-[var(--ember-text)] disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-[var(--ember-muted)]">
            Page {mobilePage} of {totalMobilePages}
          </span>
          <button
            type="button"
            onClick={() =>
              setMobilePage((current) => Math.min(totalMobilePages, current + 1))
            }
            disabled={mobilePage === totalMobilePages}
            className="rounded-full border border-[var(--ember-line)] px-4 py-2 text-sm font-medium text-[var(--ember-text)] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {shapeMenuImage && (
        <div
          className="fixed inset-0 z-50 bg-[rgba(17,17,17,0.42)] px-4 py-6"
          onClick={() => setShapeMenuImageId(null)}
        >
          <div className="mx-auto flex min-h-full max-w-xl items-end justify-center sm:items-center">
            <div
              className="w-full overflow-hidden rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.98)] shadow-[0_24px_64px_rgba(17,17,17,0.18)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b ember-divider px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="ember-eyebrow">Tend Ember</p>
                    <h3 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">
                      {getEmberTitle(shapeMenuImage)}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShapeMenuImageId(null)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ember-line)] bg-white text-[var(--ember-text)]"
                    aria-label="Close Tend Ember menu"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>

              <div className="grid gap-3 px-5 py-5">
                <button
                  type="button"
                  onClick={() =>
                    openShapeRoute(`/image/${shapeMenuImage.id}?panel=contributors`)
                  }
                  className="ember-card rounded-[1.5rem] px-4 py-4 text-left"
                >
                  <div className="text-base font-semibold text-[var(--ember-text)]">Contributors</div>
                  <p className="mt-1 text-sm text-[var(--ember-muted)]">
                    Review and manage the people connected to this Ember.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void handleShare(shapeMenuImage);
                    setShapeMenuImageId(null);
                  }}
                  className="ember-card rounded-[1.5rem] px-4 py-4 text-left"
                >
                  <div className="text-base font-semibold text-[var(--ember-text)]">Share Ember</div>
                  <p className="mt-1 text-sm text-[var(--ember-muted)]">
                    Open the share sheet or copy a direct Ember link.
                  </p>
                </button>

                {shapeMenuImage.accessType === 'owner' && (
                  <button
                    type="button"
                    onClick={() =>
                      openShapeRoute(`/image/${shapeMenuImage.id}?panel=shape&view=tag`)
                    }
                    className="ember-card rounded-[1.5rem] px-4 py-4 text-left"
                  >
                    <div className="text-base font-semibold text-[var(--ember-text)]">Add content</div>
                    <p className="mt-1 text-sm text-[var(--ember-muted)]">
                      Jump into tags and Tend Ember tools for this Ember.
                    </p>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => openShapeRoute(`/image/${shapeMenuImage.id}/wiki`)}
                  className="ember-card rounded-[1.5rem] px-4 py-4 text-left"
                >
                  <div className="text-base font-semibold text-[var(--ember-text)]">View wiki</div>
                  <p className="mt-1 text-sm text-[var(--ember-muted)]">
                    Open the full Ember wiki and its different modes.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => openShapeRoute(`/image/${shapeMenuImage.id}/story-circle`)}
                  className="ember-card rounded-[1.5rem] px-4 py-4 text-left"
                >
                  <div className="text-base font-semibold text-[var(--ember-text)]">Edit story</div>
                  <p className="mt-1 text-sm text-[var(--ember-muted)]">
                    Continue tending the story circle around this Ember.
                  </p>
                </button>

                {shapeMenuImage.accessType === 'owner' && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(shapeMenuImage)}
                    disabled={deletingImageId === shapeMenuImage.id}
                    className="ember-card rounded-[1.5rem] px-4 py-4 text-left disabled:opacity-60"
                  >
                    <div className="text-base font-semibold text-rose-700">
                      {deletingImageId === shapeMenuImage.id ? 'Deleting...' : 'Delete Ember'}
                    </div>
                    <p className="mt-1 text-sm text-[var(--ember-muted)]">
                      Permanently remove this Ember and its connected records.
                    </p>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
