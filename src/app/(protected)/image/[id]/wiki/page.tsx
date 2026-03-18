'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getEmberTitle } from '@/lib/ember-title';
import MediaPreview from '@/components/MediaPreview';
import WikiView from '@/components/WikiView';

interface WikiRecord {
  id: string;
  content: string;
  version: number;
  updatedAt: string;
  canManage: boolean;
  image: {
    originalName: string;
    title: string | null;
    description: string | null;
    filename: string;
    mediaType: 'IMAGE' | 'VIDEO';
    posterFilename: string | null;
    durationSeconds: number | null;
  };
}

export default function WikiPage() {
  const params = useParams();
  const [wiki, setWiki] = useState<WikiRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const fetchWiki = useCallback(async () => {
    try {
      const response = await fetch(`/api/wiki/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setWiki(data);
      } else if (response.status === 404) {
        setWiki(null);
      } else {
        throw new Error('Failed to fetch wiki');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wiki');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void fetchWiki();
  }, [fetchWiki]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');

    try {
      const response = await fetch(`/api/wiki/${params.id}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate wiki');
      }

      await fetchWiki();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate wiki');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-8 sm:px-6">
        <div className="ember-panel rounded-full px-6 py-3 text-sm text-[var(--ember-muted)]">
          Loading wiki...
        </div>
      </div>
    );
  }

  const emberTitle = wiki
    ? getEmberTitle({
        title: wiki.image.title,
        originalName: wiki.image.originalName,
      })
    : '';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 ember-panel-strong rounded-[2.5rem] p-6 sm:p-8">
          <Link
            href={`/image/${params.id}`}
            className="text-sm font-medium text-[var(--ember-muted)] hover:text-[var(--ember-text)]"
          >
            {'<- Back to Ember'}
          </Link>

          {error && (
            <div className="mt-6 ember-status ember-status-error">
              {error}
            </div>
          )}

          {wiki ? (
            <>
              <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
                <div className="w-full overflow-hidden rounded-[1.8rem] border border-[rgba(20,20,20,0.06)] bg-[var(--ember-charcoal)] lg:w-56 lg:bg-white">
                  <MediaPreview
                    mediaType={wiki.image.mediaType}
                    filename={wiki.image.filename}
                    posterFilename={wiki.image.posterFilename}
                    originalName={emberTitle}
                    usePosterForVideo
                    className="max-h-[22rem] w-full object-contain sm:max-h-[26rem] lg:h-56 lg:max-h-none"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="ember-eyebrow">Wiki</p>
                  <h1 className="ember-heading mt-4 break-all text-3xl leading-tight text-[var(--ember-text)] sm:break-words sm:text-4xl sm:[overflow-wrap:anywhere]">
                    {emberTitle}
                  </h1>
                  <p className="ember-copy mt-4 max-w-3xl break-words text-sm">
                    {wiki.image.description ||
                      'This synthesized memory view combines contributor responses, tags, and extracted context into a single narrative record.'}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <span className="ember-chip">Version {wiki.version}</span>
                    <span className="ember-chip">
                      Updated {new Date(wiki.updatedAt).toLocaleDateString()}
                    </span>
                    <span className="ember-chip">
                      {wiki.canManage ? 'Owner controls enabled' : 'Read only'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 min-w-0 border-t ember-divider pt-8">
                <WikiView content={wiki.content} />
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-[2rem] border border-dashed border-[rgba(20,20,20,0.12)] bg-white/70 px-6 py-12 text-center">
              <div className="ember-card mx-auto inline-flex rounded-full px-4 py-2 text-sm font-semibold text-[var(--ember-orange-deep)]">
                Memory synthesis
              </div>
              <h1 className="ember-heading mt-5 text-4xl text-[var(--ember-text)]">
                No wiki yet
              </h1>
              <p className="ember-copy mx-auto mt-4 max-w-2xl text-sm">
                Once contributors complete enough of the memory interview, Ember can
                synthesize the current record into a clean wiki. Kids Mode builds from
                that wiki, so this is the main unlock step.
              </p>
            </div>
          )}
        </section>

        <aside className="min-w-0 space-y-6">
          <section className="ember-panel rounded-[2.25rem] p-6">
            <p className="ember-eyebrow">Actions</p>
            <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)]">
              Keep the memory current
            </h2>
            <p className="ember-copy mt-3 text-sm">
              Regenerate after new contributors, new tags, or sports details have been added.
            </p>

            <button
              onClick={handleGenerate}
              disabled={generating || (wiki ? !wiki.canManage : false)}
              className="ember-button-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating
                ? 'Generating...'
                : wiki
                  ? wiki.canManage
                    ? 'Regenerate wiki'
                    : 'Wiki locked'
                  : 'Generate wiki'}
            </button>
          </section>

          <section className="ember-panel rounded-[2.25rem] p-6">
            <p className="ember-eyebrow">Modes</p>
            <div className="mt-4 grid gap-3">
              <Link href={`/image/${params.id}/kids`} className="ember-button-secondary w-full justify-between">
                <span>Kids mode</span>
                <span>Storybook</span>
              </Link>
              <Link href={`/image/${params.id}/story-circle`} className="ember-button-secondary w-full justify-between">
                <span>Story circle</span>
                <span>Thread</span>
              </Link>
              <Link href={`/image/${params.id}/sports`} className="ember-button-secondary w-full justify-between">
                <span>Sports mode</span>
                <span>Stats</span>
              </Link>
              <Link href={`/image/${params.id}/chat`} className="ember-button-secondary w-full justify-between">
                <span>Ask Ember</span>
                <span>Q&amp;A</span>
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
