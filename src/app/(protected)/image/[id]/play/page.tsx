'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getEmberTitle } from '@/lib/ember-title';
import MediaPreview from '@/components/MediaPreview';

type PlayPageData = {
  id: string;
  filename: string;
  mediaType: 'IMAGE' | 'VIDEO';
  posterFilename: string | null;
  durationSeconds: number | null;
  originalName: string;
  title: string | null;
  description: string | null;
  createdAt: string;
  canManage: boolean;
  wiki: {
    id: string;
    content: string;
    version: number;
    updatedAt: string;
  } | null;
};

function PlayIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="m8 5.75 10 6.25L8 18.25V5.75Z" />
    </svg>
  );
}

function BookIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M5.75 5.5a2.25 2.25 0 0 1 2.25-2.25h10.25v15.5H8a2.25 2.25 0 0 0-2.25 2.25V5.5Z" />
      <path d="M5.75 5.5a2.25 2.25 0 0 1 2.25-2.25H18.5v15.5H8a2.25 2.25 0 0 0-2.25 2.25" />
    </svg>
  );
}

function SparkIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="m12 2.75 1.85 5.38 5.4 1.87-5.4 1.86L12 17.25l-1.85-5.39-5.4-1.86 5.4-1.87L12 2.75Z" />
    </svg>
  );
}

function BallIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 3.75c2.35 2.2 3.52 4.95 3.52 8.25s-1.17 6.05-3.52 8.25" />
      <path d="M12 3.75c-2.35 2.2-3.52 4.95-3.52 8.25s1.17 6.05 3.52 8.25" />
      <path d="M4 12h16" />
    </svg>
  );
}

function getNarrationText(content: string): string {
  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[`*_>#]/g, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export default function PlayEmberPage() {
  const params = useParams<{ id: string }>();
  const imageId = params.id;

  const [data, setData] = useState<PlayPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isNarrating, setIsNarrating] = useState(false);
  const [narrationError, setNarrationError] = useState('');

  const loadImage = useCallback(async () => {
    if (!imageId) {
      return;
    }

    try {
      const response = await fetch(`/api/images/${imageId}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load Play Ember');
      }

      setData(payload);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load Play Ember');
    } finally {
      setLoading(false);
    }
  }, [imageId]);

  useEffect(() => {
    void loadImage();
  }, [loadImage]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const emberTitle = data ? getEmberTitle(data) : '';
  const narrationText = useMemo(
    () => (data?.wiki?.content ? getNarrationText(data.wiki.content) : ''),
    [data?.wiki?.content]
  );

  const handleNarrationToggle = () => {
    if (!data?.wiki?.content) {
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setNarrationError('Narration is not available in this browser.');
      return;
    }

    setNarrationError('');

    if (isNarrating) {
      window.speechSynthesis.cancel();
      setIsNarrating(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(narrationText);
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.onend = () => setIsNarrating(false);
    utterance.onerror = () => {
      setIsNarrating(false);
      setNarrationError('Narration could not be played on this device.');
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsNarrating(true);
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-8 sm:px-6">
        <div className="ember-panel rounded-full px-6 py-3 text-sm text-[var(--ember-muted)]">
          Loading Play Ember...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-8 sm:px-6">
        <div className="ember-panel rounded-[2rem] p-8 text-center">
          <p className="mb-4 text-rose-600">{error || 'Ember not found'}</p>
          <Link href="/feed" className="font-semibold text-[var(--ember-orange-deep)]">
            Back to feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="ember-panel-strong rounded-[2.5rem] p-6 sm:p-8">
          <Link
            href={`/image/${imageId}`}
            className="text-sm font-medium text-[var(--ember-muted)] hover:text-[var(--ember-text)]"
          >
            {'<- Back to Ember'}
          </Link>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="w-full overflow-hidden rounded-[1.8rem] border border-[rgba(20,20,20,0.06)] bg-white lg:w-56">
              <MediaPreview
                mediaType={data.mediaType}
                filename={data.filename}
                posterFilename={data.posterFilename}
                originalName={emberTitle}
                usePosterForVideo
                controls={data.mediaType === 'VIDEO'}
                className="max-h-[22rem] w-full object-contain bg-[var(--ember-charcoal)] lg:h-56 lg:max-h-none"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="ember-eyebrow">Play Ember</p>
              <h1 className="ember-heading mt-4 break-words text-3xl leading-tight text-[var(--ember-text)] [overflow-wrap:anywhere] sm:text-4xl">
                {emberTitle}
              </h1>
              <p className="ember-copy mt-4 max-w-3xl text-sm">
                {data.description ||
                  'Turn this Ember into different story experiences, read it aloud, and explore the memory in new ways.'}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="ember-chip">
                  {data.wiki ? `Story v${data.wiki.version}` : 'Story not generated yet'}
                </span>
                <span className="ember-chip">
                  {data.mediaType === 'VIDEO' ? 'Video Ember' : 'Photo Ember'}
                </span>
                <span className="ember-chip">
                  Captured {new Date(data.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="ember-panel rounded-[2.25rem] p-6">
          <p className="ember-eyebrow">Listen</p>
          <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)]">
            Hear the memory out loud
          </h2>
          <p className="ember-copy mt-3 text-sm">
            Use your device voice to narrate the current Ember story. This works best after the story has been generated on the main Ember page.
          </p>

          {narrationError && (
            <div className="mt-5 ember-status ember-status-error">
              {narrationError}
            </div>
          )}

          <button
            type="button"
            onClick={handleNarrationToggle}
            disabled={!data.wiki?.content}
            className="ember-button-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isNarrating ? 'Stop narration' : 'Listen to narration'}
          </button>

          {!data.wiki?.content && (
            <p className="mt-3 text-sm text-[var(--ember-muted)]">
              Generate the memory story on the main Ember page first.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link
          href={`/image/${imageId}/kids`}
          className="ember-card rounded-[1.8rem] px-5 py-5 transition hover:border-[rgba(255,102,33,0.24)]"
        >
          <BookIcon className="h-5 w-5 text-[var(--ember-orange)]" />
          <div className="mt-4 text-xl font-semibold text-[var(--ember-text)]">Kids Mode</div>
          <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">
            Turn the memory into an illustrated storybook.
          </p>
        </Link>

        <button
          type="button"
          onClick={handleNarrationToggle}
          disabled={!data.wiki?.content}
          className="ember-card rounded-[1.8rem] px-5 py-5 text-left transition hover:border-[rgba(255,102,33,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <PlayIcon className="h-5 w-5 text-[var(--ember-orange)]" />
          <div className="mt-4 text-xl font-semibold text-[var(--ember-text)]">
            {isNarrating ? 'Stop narration' : 'Narrate memory'}
          </div>
          <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">
            Read the current Ember story aloud using your browser voice.
          </p>
        </button>

        <Link
          href={`/image/${imageId}/story-circle`}
          className="ember-card rounded-[1.8rem] px-5 py-5 transition hover:border-[rgba(255,102,33,0.24)]"
        >
          <SparkIcon className="h-5 w-5 text-[var(--ember-orange)]" />
          <div className="mt-4 text-xl font-semibold text-[var(--ember-text)]">Story Circle</div>
          <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">
            See the full conversation trail behind the memory.
          </p>
        </Link>

        <Link
          href={`/image/${imageId}/sports`}
          className="ember-card rounded-[1.8rem] px-5 py-5 transition hover:border-[rgba(255,102,33,0.24)]"
        >
          <BallIcon className="h-5 w-5 text-[var(--ember-orange)]" />
          <div className="mt-4 text-xl font-semibold text-[var(--ember-text)]">Sports Mode</div>
          <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">
            Add structured stats and the game story when the memory is sports-related.
          </p>
        </Link>
      </section>

      <section className="mt-6 ember-panel rounded-[2.25rem] p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <div>
            <p className="ember-eyebrow">More ways to explore</p>
            <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)]">
              Keep moving through the memory
            </h2>
            <p className="ember-copy mt-3 text-sm">
              Jump back to the main Ember story, ask questions, or keep shaping the memory before you play it in a different format.
            </p>
          </div>

          <div className="grid gap-3">
            <Link href={`/image/${imageId}`} className="ember-button-secondary">
              Open Ember
            </Link>
            <Link href={`/image/${imageId}/chat`} className="ember-button-secondary">
              Ask Ember
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
