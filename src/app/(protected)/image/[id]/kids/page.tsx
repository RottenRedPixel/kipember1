'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import KidsFlipbook from '@/components/KidsFlipbook';
import { getPreviewMediaUrl } from '@/lib/media';

type KidsStoryPanel = {
  id: string;
  position: number;
  title: string;
  caption: string;
  filename: string;
};

type KidsStory = {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  visualStyle: string | null;
  status: string;
  errorMessage: string | null;
  version: number;
  updatedAt: string;
  panels: KidsStoryPanel[];
};

type KidsPageData = {
  image: {
    id: string;
    filename: string;
    mediaType: 'IMAGE' | 'VIDEO';
    posterFilename: string | null;
    originalName: string;
    description: string | null;
  };
  canManage: boolean;
  wiki: {
    id: string;
    version: number;
    updatedAt: string;
  } | null;
  story: KidsStory | null;
};

export default function KidsModePage() {
  const params = useParams<{ id: string }>();
  const imageId = params.id;

  const [data, setData] = useState<KidsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const fetchKidsStory = useCallback(
    async (showLoader = false) => {
      if (!imageId) {
        return;
      }

      if (showLoader) {
        setLoading(true);
      }

      try {
        const response = await fetch(`/api/kids/${imageId}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || 'Failed to load Kids Mode');
        }

        const nextData = (await response.json()) as KidsPageData;
        setData(nextData);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Kids Mode');
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [imageId]
  );

  useEffect(() => {
    void fetchKidsStory(true);
  }, [fetchKidsStory]);

  useEffect(() => {
    if (data?.story?.status !== 'generating') {
      return;
    }

    const timer = window.setInterval(() => {
      void fetchKidsStory(false);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [data?.story?.status, fetchKidsStory]);

  const handleGenerate = async () => {
    if (!imageId) {
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const response = await fetch(`/api/kids/${imageId}`, {
        method: 'POST',
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error || 'Failed to generate Kids Mode');
      }

      setData((current) =>
        current
          ? {
              ...current,
              story: body.story,
            }
          : current
      );

      await fetchKidsStory(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate Kids Mode');
    } finally {
      setGenerating(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-8 sm:px-6">
        <div className="ember-panel rounded-full px-6 py-3 text-sm text-[var(--ember-muted)]">
          Loading Kids Mode...
        </div>
      </div>
    );
  }

  const { image, wiki, story } = data;
  const storyIsGenerating = story?.status === 'generating';
  const storyHasError = story?.status === 'error';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <section className="mb-6 grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="ember-panel-strong rounded-[2.5rem] p-6 sm:p-8">
          <Link
            href={`/image/${imageId}/play`}
            className="text-sm font-medium text-[var(--ember-muted)] hover:text-[var(--ember-text)]"
          >
            {'<- Back to Play Ember'}
          </Link>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="overflow-hidden rounded-[1.8rem] border border-[rgba(20,20,20,0.06)] bg-white lg:w-56">
              <Image
                src={getPreviewMediaUrl({
                  mediaType: image.mediaType,
                  filename: image.filename,
                  posterFilename: image.posterFilename,
                })}
                alt={image.originalName}
                width={320}
                height={320}
                unoptimized
                className="h-56 w-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="ember-eyebrow">Kids mode</p>
              <h1 className="ember-heading mt-4 text-4xl text-[var(--ember-text)]">
                Turn this memory into a storybook
              </h1>
              <p className="ember-copy mt-4 max-w-3xl text-sm">
                Create a five-scene illustrated retelling based on the wiki so younger
                viewers can experience the same memory in a more guided and visual way.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="ember-chip">Wiki v{wiki?.version ?? '0'}</span>
                {story && <span className="ember-chip">Story v{story.version}</span>}
                <span className="ember-chip">
                  {story?.status === 'ready' ? 'Ready to read' : 'Awaiting story'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="ember-panel rounded-[2.25rem] p-6">
          <p className="ember-eyebrow">Generate</p>
          <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)]">
            Build the illustrated version
          </h2>
          <p className="ember-copy mt-3 text-sm">
            Kids Mode depends on the wiki first, then renders a lightweight story arc
            with scene imagery and simplified narration.
          </p>

          <button
            onClick={handleGenerate}
            disabled={!wiki || !data.canManage || generating || storyIsGenerating}
            className="ember-button-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {!data.canManage
              ? 'Owner only'
              : story
                ? storyIsGenerating || generating
                  ? 'Generating storybook...'
                  : 'Regenerate kids story'
                : generating
                  ? 'Generating storybook...'
                  : 'Create kids story'}
          </button>

          <div className="mt-6 grid gap-3">
            <Link href={`/image/${imageId}/play`} className="ember-button-secondary">
              Back to Play Ember
            </Link>
            <Link href={`/image/${imageId}`} className="ember-button-secondary">
              Back to workspace
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-6 ember-status ember-status-error">
          {error}
        </div>
      )}

      {!wiki && (
        <div className="ember-panel rounded-[2.25rem] p-8">
          <h2 className="ember-heading text-3xl text-[var(--ember-text)]">
            Generate the wiki first
          </h2>
          <p className="ember-copy mt-3 max-w-2xl text-sm">
            Kids Mode builds its story arc from the synthesized wiki, so the memory
            needs that base layer before a storybook can be rendered.
          </p>
        </div>
      )}

      {wiki && storyIsGenerating && (
        <div className="ember-panel rounded-[2.25rem] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="ember-eyebrow">In progress</p>
              <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)]">
                Story pages are rendering now
              </h2>
              <p className="ember-copy mt-3 max-w-2xl text-sm">
                Ember is turning the wiki into a child-friendly five-scene flipbook.
                This page refreshes automatically while the story is being generated.
              </p>
            </div>
            <div className="kids-mode-loader h-16 w-16 rounded-full border-4 border-[rgba(255,102,33,0.14)] border-t-[var(--ember-orange)]" />
          </div>
        </div>
      )}

      {wiki && storyHasError && (
        <div className="mb-6 ember-status ember-status-error">
          {story?.errorMessage || 'Try generating the kids story again.'}
        </div>
      )}

      {wiki && story?.status === 'ready' && story.panels.length > 0 && (
        <>
          <KidsFlipbook
            title={story.title}
            subtitle={story.subtitle}
            summary={story.summary}
            panels={story.panels}
          />

          <div className="mt-6 ember-panel rounded-[2.25rem] p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <p className="ember-eyebrow">Story direction</p>
                <p className="ember-copy mt-4 text-sm">
                  {story.visualStyle ||
                    'A bright illustrated storybook world with consistent characters and a clear narrative throughline.'}
                </p>
              </div>
              <div className="ember-card rounded-[1.6rem] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ember-muted)]">
                  Best use
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--ember-text)]">
                  Share this mode with kids, grandkids, or classrooms when you want
                  the same memory to feel more like a guided visual adventure than a
                  standard wiki article.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {wiki && !story && !generating && (
        <div className="ember-panel rounded-[2.25rem] p-8">
          <h2 className="ember-heading text-3xl text-[var(--ember-text)]">
            No kids story yet
          </h2>
          <p className="ember-copy mt-3 max-w-2xl text-sm">
            The wiki is ready. Generate Kids Mode to build a five-page flipbook with
            new scene images based on the story arc.
          </p>
        </div>
      )}
    </div>
  );
}
