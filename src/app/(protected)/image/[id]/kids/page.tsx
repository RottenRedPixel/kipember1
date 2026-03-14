'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import KidsFlipbook from '@/components/KidsFlipbook';

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
    originalName: string;
    description: string | null;
  };
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
    fetchKidsStory(true);
  }, [fetchKidsStory]);

  useEffect(() => {
    if (data?.story?.status !== 'generating') {
      return;
    }

    const timer = window.setInterval(() => {
      fetchKidsStory(false);
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
      <div className="min-h-screen bg-[linear-gradient(180deg,_#fef3c7_0%,_#fff7ed_45%,_#eff6ff_100%)]">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4">
          <div className="rounded-full bg-white/80 px-6 py-3 text-sm font-semibold tracking-[0.18em] text-slate-500 shadow-sm backdrop-blur">
            Loading Kids Mode...
          </div>
        </div>
      </div>
    );
  }

  const { image, wiki, story } = data;
  const storyIsGenerating = story?.status === 'generating';
  const storyHasError = story?.status === 'error';

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#fef3c7_0%,_#fff7ed_32%,_#eff6ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href={`/image/${imageId}/wiki`}
              className="inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              &larr; Back to Wiki
            </Link>
            <div className="mt-4 inline-flex items-center rounded-full bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-rose-600 shadow-sm backdrop-blur">
              Kids Mode
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Flip this memory into a storybook adventure
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              Turn the wiki into five illustrated story pages with a playful 3D
              animated look, then flip through the memory like a picture book.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/60 bg-white/70 p-4 shadow-[0_20px_60px_rgba(251,146,60,0.18)] backdrop-blur sm:p-5">
            <div className="flex items-center gap-4">
              <Image
                src={`/api/uploads/${image.filename}`}
                alt={image.originalName}
                width={80}
                height={80}
                unoptimized
                className="h-20 w-20 rounded-2xl object-cover shadow-sm"
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {image.originalName}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                  Wiki v{wiki?.version ?? '0'}
                  {story ? `  •  Story v${story.version}` : ''}
                </div>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={!wiki || generating || storyIsGenerating}
              className="mt-4 w-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {story
                ? storyIsGenerating || generating
                  ? 'Generating Storybook...'
                  : 'Regenerate Kids Story'
                : generating
                  ? 'Generating Storybook...'
                  : 'Create Kids Story'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {!wiki && (
          <div className="rounded-[2rem] border border-amber-200/80 bg-white/85 p-8 shadow-[0_20px_60px_rgba(251,191,36,0.14)] backdrop-blur">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              Generate the wiki first
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Kids Mode builds a story arc from the wiki, so it needs the memory
              synthesis step first.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/image/${imageId}/wiki`}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Go Generate Wiki
              </Link>
              <Link
                href={`/image/${imageId}`}
                className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
              >
                Back to Image
              </Link>
            </div>
          </div>
        )}

        {wiki && storyIsGenerating && (
          <div className="mb-8 overflow-hidden rounded-[2rem] border border-amber-200/80 bg-white/80 p-8 shadow-[0_20px_60px_rgba(14,165,233,0.16)] backdrop-blur">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                  In Progress
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">
                  Story pages are rendering now
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  The app is turning the wiki into a child-friendly five-scene
                  flipbook and generating each illustration. This page refreshes
                  automatically while it runs.
                </p>
              </div>
              <div className="kids-mode-loader h-20 w-20 self-center rounded-full border-8 border-amber-200 border-t-rose-500" />
            </div>
          </div>
        )}

        {wiki && storyHasError && (
          <div className="mb-8 rounded-[2rem] border border-red-200 bg-white/85 p-8 shadow-[0_20px_60px_rgba(248,113,113,0.16)] backdrop-blur">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              The storybook hit an error
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              {story?.errorMessage || 'Try generating the kids story again.'}
            </p>
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

            <div className="mt-8 rounded-[2rem] border border-white/60 bg-white/70 p-6 shadow-[0_20px_60px_rgba(148,163,184,0.14)] backdrop-blur">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Story Direction
                  </div>
                  <p className="mt-3 text-base leading-7 text-slate-600">
                    {story.visualStyle ||
                      'A bright 3D animated storybook world with consistent characters and playful cinematic motion.'}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-amber-200/80 bg-[linear-gradient(180deg,_rgba(255,251,235,0.95),_rgba(255,255,255,0.92))] p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-500">
                    Best Use
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Share this mode with kids, grandkids, or classrooms when you
                    want the same memory to feel more like a guided visual
                    adventure than a standard wiki article.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {wiki && !story && !generating && (
          <div className="rounded-[2rem] border border-amber-200/80 bg-white/85 p-8 shadow-[0_20px_60px_rgba(251,191,36,0.14)] backdrop-blur">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              No kids story yet
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              The wiki is ready. Generate Kids Mode to build a five-page flipbook
              with new scene images based on the story arc.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
