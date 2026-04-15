'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getEmberTitle } from '@/lib/ember-title';
import ChatInterface from '@/components/ChatInterface';
import MediaPreview from '@/components/MediaPreview';

interface ImageRecord {
  id: string;
  filename: string;
  mediaType: 'IMAGE' | 'VIDEO';
  posterFilename: string | null;
  originalName: string;
  title: string | null;
  description: string | null;
}

export default function ChatPage() {
  const params = useParams();
  const [image, setImage] = useState<ImageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const response = await fetch(`/api/images/${params.id}`);
        if (!response.ok) {
          throw new Error('Image not found');
        }

        const data = await response.json();
        setImage(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load image');
      } finally {
        setLoading(false);
      }
    };

    void fetchImage();
  }, [params.id]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-8 sm:px-6">
        <div className="ember-panel rounded-full px-6 py-3 text-sm text-[var(--ember-muted)]">
          Loading chat...
        </div>
      </div>
    );
  }

  if (error || !image) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-8 sm:px-6">
        <div className="ember-panel rounded-[2rem] p-8 text-center">
          <p className="mb-4 text-rose-600">{error || 'Image not found'}</p>
          <Link href="/feed" className="font-semibold text-[var(--ember-orange-deep)]">
            Back to feed
          </Link>
        </div>
      </div>
    );
  }

  const emberTitle = getEmberTitle(image);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <section className="mb-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="ember-panel rounded-[2.25rem] p-6">
          <Link
            href={`/image/${params.id}`}
            className="text-sm font-medium text-[var(--ember-muted)] hover:text-[var(--ember-text)]"
          >
            {'<- Back to Ember'}
          </Link>

            <div className="mt-5 overflow-hidden ember-photo-shell border border-[rgba(20,20,20,0.06)] bg-white">
              <MediaPreview
                mediaType={image.mediaType}
                filename={image.filename}
              posterFilename={image.posterFilename}
              originalName={emberTitle}
              controls={image.mediaType === 'VIDEO'}
              className="h-72 w-full object-contain bg-[var(--ember-bg)]"
            />
          </div>

          <div className="mt-5">
            <p className="ember-eyebrow">
              {image.mediaType === 'VIDEO' ? 'Video Q&A' : 'Photo Q&A'}
            </p>
            <h1 className="ember-heading mt-3 break-words text-3xl text-[var(--ember-text)] [overflow-wrap:anywhere]">
              {emberTitle}
            </h1>
            <p className="ember-copy mt-3 text-sm">
              {image.description ||
                'Ask about what is visible here, what contributors shared, and how this memory is currently documented.'}
            </p>
          </div>
        </div>

        <div className="ember-panel rounded-[2.25rem] p-6">
          <p className="ember-eyebrow">Shortcuts</p>
          <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)]">
            Move between synthesis views
          </h2>
          <p className="ember-copy mt-3 text-sm">
            Chat works best when the underlying memory is already tagged, contributed
            to, and optionally synthesized into a wiki.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/image/${params.id}`} className="ember-button-secondary">
              Open Ember
            </Link>
            <Link href={`/image/${params.id}/story-circle`} className="ember-button-secondary">
              Story circle
            </Link>
            <Link href={`/image/${params.id}/play`} className="ember-button-secondary">
              Play Ember
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="ember-card rounded-[1.6rem] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ember-muted)]">
                Best prompts
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--ember-text)]">
                Ask who is visible, what moment this captures, or where details are still uncertain.
              </p>
            </div>
            <div className="ember-card rounded-[1.6rem] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ember-muted)]">
                Expected behavior
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--ember-text)]">
                Ember should cite what is known from contributors and avoid inventing missing facts.
              </p>
            </div>
          </div>
        </div>
      </section>

      <ChatInterface
        imageId={image.id}
        subjectNoun={image.mediaType === 'VIDEO' ? 'video' : 'photo'}
      />
    </div>
  );
}
