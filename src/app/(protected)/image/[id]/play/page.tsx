'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getEmberTitle } from '@/lib/ember-title';
import MediaPreview from '@/components/MediaPreview';
import type { NarrationPreference } from '@/lib/elevenlabs';
import { Play, BookOpen, Sparkles, Globe } from 'lucide-react';

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


export default function PlayEmberPage() {
  const params = useParams<{ id: string }>();
  const imageId = params.id;

  const [data, setData] = useState<PlayPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [narrationState, setNarrationState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [narrationError, setNarrationError] = useState('');
  const [voicePreference, setVoicePreference] = useState<NarrationPreference>('female');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

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
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  const emberTitle = data ? getEmberTitle(data) : '';

  const stopNarration = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setNarrationState('idle');
  }, []);

  const handleNarrationToggle = async () => {
    if (!data?.wiki?.content) {
      return;
    }

    setNarrationError('');

    if (narrationState === 'loading' || narrationState === 'playing') {
      stopNarration();
      return;
    }

    setNarrationState('loading');

    try {
      const response = await fetch('/api/narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: data.wiki.content,
          voicePreference,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Narration could not be generated.');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audioUrlRef.current = audioUrl;
      audioRef.current = audio;

      audio.onended = () => {
        stopNarration();
      };

      audio.onerror = () => {
        stopNarration();
        setNarrationError('Narration could not be played on this device.');
      };

      await audio.play();
      setNarrationState('playing');
    } catch (playError) {
      stopNarration();
      setNarrationError(
        playError instanceof Error ? playError.message : 'Narration could not be generated.'
      );
    }
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
              <div className="ember-photo-shell w-full border border-[rgba(20,20,20,0.06)] bg-white lg:w-56">
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
            Choose a male or female voice and let ElevenLabs read the Ember story like a narrative, without the utility headings.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {(['female', 'male'] as NarrationPreference[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setVoicePreference(option)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  voicePreference === option
                    ? 'border-[var(--ember-orange)] bg-[rgba(255,102,33,0.08)] text-[var(--ember-orange-deep)]'
                    : 'border-[var(--ember-line-strong)] text-[var(--ember-text)]'
                }`}
              >
                {option === 'female' ? 'Female voice' : 'Male voice'}
              </button>
            ))}
          </div>

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
            {narrationState === 'loading'
              ? 'Generating narration...'
              : narrationState === 'playing'
                ? 'Stop narration'
                : 'Listen to narration'}
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
          <BookOpen className="h-5 w-5 text-[var(--ember-orange)]" />
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
          <Play className="h-5 w-5 text-[var(--ember-orange)]" />
          <div className="mt-4 text-xl font-semibold text-[var(--ember-text)]">
            {narrationState === 'loading'
              ? 'Generating narration'
              : narrationState === 'playing'
                ? 'Stop narration'
                : 'Narrate memory'}
          </div>
          <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">
            Read the Ember story aloud with your selected ElevenLabs voice.
          </p>
        </button>

        <Link
          href={`/image/${imageId}/story-circle`}
          className="ember-card rounded-[1.8rem] px-5 py-5 transition hover:border-[rgba(255,102,33,0.24)]"
        >
          <Sparkles className="h-5 w-5 text-[var(--ember-orange)]" />
          <div className="mt-4 text-xl font-semibold text-[var(--ember-text)]">Story Circle</div>
          <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">
            See the full conversation trail behind the memory.
          </p>
        </Link>

        <Link
          href={`/image/${imageId}/sports`}
          className="ember-card rounded-[1.8rem] px-5 py-5 transition hover:border-[rgba(255,102,33,0.24)]"
        >
          <Globe className="h-5 w-5 text-[var(--ember-orange)]" />
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
