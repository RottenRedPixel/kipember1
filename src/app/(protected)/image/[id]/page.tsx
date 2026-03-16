'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ContributorList from '@/components/ContributorList';
import TagManager from '@/components/TagManager';
import InteractiveImageTagger from '@/components/InteractiveImageTagger';

interface ImageRecord {
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
  canManage: boolean;
  owner: {
    id: string;
    name: string | null;
    email: string;
  };
  contributors: {
    id: string;
    phoneNumber: string | null;
    email: string | null;
    name: string | null;
    userId: string | null;
    token: string;
    inviteSent: boolean;
    user: {
      id: string;
      name: string | null;
      email: string;
      phoneNumber: string | null;
    } | null;
    conversation: {
      status: string;
      currentStep: string;
    } | null;
    voiceCalls: {
      id: string;
      status: string;
      startedAt: string | null;
      endedAt: string | null;
      createdAt: string;
      callSummary: string | null;
      initiatedBy: string;
    }[];
  }[];
  tags: {
    id: string;
    label: string;
    email: string | null;
    phoneNumber: string | null;
    leftPct: number | null;
    topPct: number | null;
    widthPct: number | null;
    heightPct: number | null;
    userId: string | null;
    contributorId: string | null;
    user: {
      id: string;
      name: string | null;
      email: string;
      phoneNumber: string | null;
    } | null;
    contributor: {
      id: string;
      name: string | null;
      email: string | null;
      phoneNumber: string | null;
      inviteSent: boolean;
    } | null;
  }[];
  friends: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
  }[];
  wiki: {
    id: string;
  } | null;
  sportsMode: {
    id: string;
    sportType: string | null;
    subjectName: string | null;
    finalScore: string | null;
    outcome: string | null;
    updatedAt: string;
  } | null;
}

export default function ImagePage() {
  const params = useParams();
  const [image, setImage] = useState<ImageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareToNetwork, setShareToNetwork] = useState(false);
  const [savingShareState, setSavingShareState] = useState(false);
  const [shareError, setShareError] = useState('');

  const fetchImage = useCallback(async () => {
    try {
      const response = await fetch(`/api/images/${params.id}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Image not found');
      }

      setImage(payload);
      setShareToNetwork(payload.shareToNetwork);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchImage();
  }, [fetchImage]);

  const handleShareSave = async () => {
    if (!image) {
      return;
    }

    setSavingShareState(true);
    setShareError('');

    try {
      const response = await fetch(`/api/images/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareToNetwork }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update sharing');
      }

      setImage((prev) => (prev ? { ...prev, shareToNetwork: payload.shareToNetwork } : prev));
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Failed to update sharing');
    } finally {
      setSavingShareState(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-[var(--ember-muted)]">Loading Ember...</div>
      </div>
    );
  }

  if (error || !image) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="ember-panel rounded-[2rem] p-8 text-center">
          <p className="mb-4 text-rose-600">{error || 'Image not found'}</p>
          <Link href="/feed" className="font-medium text-[var(--ember-orange-deep)] hover:text-[var(--ember-orange)]">
            Back to feed
          </Link>
        </div>
      </div>
    );
  }

  const completedCount = image.contributors.filter(
    (contributor) => contributor.conversation?.status === 'completed'
  ).length;

  const accessLabel =
    image.accessType === 'owner'
      ? 'Owner workspace'
      : image.accessType === 'contributor'
        ? 'Contributor access'
        : 'Network view';

  return (
    <div className="mx-auto max-w-[84rem] px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/feed" className="text-sm font-medium text-[var(--ember-muted)] hover:text-[var(--ember-text)]">
          {'<- Back to feed'}
        </Link>
        <div className="flex flex-wrap gap-2">
          {image.wiki && (
            <Link href={`/image/${image.id}/wiki`} className="ember-button-secondary min-h-0 px-4 py-2">
              View wiki
            </Link>
          )}
          <Link href={`/image/${image.id}/chat`} className="ember-button-secondary min-h-0 px-4 py-2">
            Ask Ember
          </Link>
          <Link href={`/image/${image.id}/story-circle`} className="ember-button-secondary min-h-0 px-4 py-2">
            Story circle
          </Link>
          <Link href={`/image/${image.id}/sports`} className="ember-button-secondary min-h-0 px-4 py-2">
            {image.sportsMode ? 'Update sports mode' : 'Sports mode'}
          </Link>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="space-y-8">
          <section className="ember-panel rounded-[2.25rem] p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="ember-eyebrow">{accessLabel}</p>
                <h1 className="ember-heading mt-3 break-words text-4xl text-[var(--ember-text)] [overflow-wrap:anywhere]">
                  {image.originalName}
                </h1>
                <p className="ember-copy mt-3 max-w-2xl text-sm">
                  {image.description || 'No description has been added to this Ember yet.'}
                </p>
              </div>
              <div className="ember-card rounded-[1.5rem] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.14em] text-[var(--ember-muted)]">Owner</div>
                <div className="mt-2 font-semibold text-[var(--ember-text)]">
                  {image.owner.name || image.owner.email}
                </div>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              <span className="ember-chip">{image.mediaType === 'VIDEO' ? 'Video Ember' : 'Photo Ember'}</span>
              <span className="ember-chip">{image.contributors.length} contributors</span>
              <span className="ember-chip">{completedCount} completed</span>
              <span className="ember-chip">{image.tags.length} tagged</span>
              {image.shareToNetwork && <span className="ember-chip">Shared to network</span>}
            </div>

            <InteractiveImageTagger
              imageId={image.id}
              mediaType={image.mediaType}
              imageUrl={
                image.mediaType === 'VIDEO'
                  ? image.posterFilename
                    ? `/api/uploads/${image.posterFilename}`
                    : null
                  : `/api/uploads/${image.filename}`
              }
              videoUrl={image.mediaType === 'VIDEO' ? `/api/uploads/${image.filename}` : null}
              durationSeconds={image.durationSeconds}
              imageName={image.originalName}
              tags={image.tags}
              contributors={image.contributors.map((contributor) => ({
                id: contributor.id,
                name: contributor.name,
                email: contributor.email,
                phoneNumber: contributor.phoneNumber,
                userId: contributor.userId,
              }))}
              friends={image.friends}
              canManage={image.canManage}
              onUpdate={fetchImage}
            />

            {image.canManage && (
              <div className="ember-card mt-6 rounded-[1.75rem] px-5 py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="ember-heading text-2xl text-[var(--ember-text)]">Network sharing</h2>
                    <p className="ember-copy mt-2 text-sm">
                      Let accepted friends see this Ember in their feed.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={shareToNetwork}
                      onChange={(event) => setShareToNetwork(event.target.checked)}
                      className="h-4 w-4 rounded border-[var(--ember-line-strong)] text-[var(--ember-orange)]"
                    />
                    <span className="text-sm font-medium text-[var(--ember-text)]">Share to network</span>
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleShareSave}
                    disabled={savingShareState || shareToNetwork === image.shareToNetwork}
                    className="ember-button-primary disabled:opacity-60"
                  >
                    {savingShareState ? 'Saving...' : 'Save sharing'}
                  </button>
                  {shareError && <span className="text-sm text-rose-600">{shareError}</span>}
                </div>
              </div>
            )}
          </section>

          <TagManager
            imageId={image.id}
            tags={image.tags}
            contributors={image.contributors.map((contributor) => ({
              id: contributor.id,
              name: contributor.name,
              email: contributor.email,
              phoneNumber: contributor.phoneNumber,
              userId: contributor.userId,
            }))}
            friends={image.friends}
            canManage={image.canManage}
            onUpdate={fetchImage}
          />
        </div>

        <div className="xl:sticky xl:top-24 xl:self-start">
          {image.canManage ? (
            <ContributorList
              imageId={image.id}
              contributors={image.contributors}
              friends={image.friends}
              onUpdate={fetchImage}
            />
          ) : (
            <div className="ember-panel rounded-[2rem] p-6">
              <p className="ember-eyebrow">Contributors</p>
              <h2 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">People connected to this Ember</h2>
              <div className="mt-6 space-y-3">
                {image.contributors.length === 0 ? (
                  <p className="text-sm text-[var(--ember-muted)]">No contributors have been added yet.</p>
                ) : (
                  image.contributors.map((contributor) => (
                    <div key={contributor.id} className="ember-card rounded-[1.5rem] px-4 py-4">
                      <div className="font-semibold text-[var(--ember-text)]">
                        {contributor.name ||
                          contributor.user?.name ||
                          contributor.email ||
                          contributor.phoneNumber ||
                          'Contributor'}
                      </div>
                      {(contributor.email || contributor.phoneNumber) && (
                        <div className="mt-1 text-sm text-[var(--ember-muted)]">
                          {contributor.email || contributor.phoneNumber}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
