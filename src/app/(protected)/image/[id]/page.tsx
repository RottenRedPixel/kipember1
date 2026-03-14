'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ContributorList from '@/components/ContributorList';
import TagManager from '@/components/TagManager';

interface ImageRecord {
  id: string;
  filename: string;
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
    userId: string | null;
    contributorId: string | null;
    user: {
      id: string;
      name: string | null;
      email: string;
    } | null;
    contributor: {
      id: string;
      name: string | null;
      email: string | null;
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
        <div className="text-slate-500">Loading Ember...</div>
      </div>
    );
  }

  if (error || !image) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-rose-500">{error || 'Image not found'}</p>
          <Link href="/feed" className="font-medium text-sky-600 hover:text-sky-700">
            Back to feed
          </Link>
        </div>
      </div>
    );
  }

  const completedCount = image.contributors.filter(
    (contributor) => contributor.conversation?.status === 'completed'
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/feed" className="text-sm font-medium text-slate-600 hover:text-slate-950">
          &larr; Back to Feed
        </Link>
        <div className="flex flex-wrap gap-3">
          {image.wiki && (
            <Link
              href={`/image/${image.id}/wiki`}
              className="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-600"
            >
              View Wiki
            </Link>
          )}
          <Link
            href={`/image/${image.id}/chat`}
            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
          >
            Chat with Ember
          </Link>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-8">
          <div className="overflow-hidden rounded-[2.5rem] border border-white/85 bg-white shadow-sm">
            <img
              src={`/api/uploads/${image.filename}`}
              alt={image.originalName}
              className="h-[28rem] w-full object-contain bg-slate-100"
            />
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {image.accessType === 'owner'
                      ? 'Your Ember'
                      : image.accessType === 'contributor'
                        ? 'You are a contributor'
                        : 'Shared from your network'}
                  </p>
                  <h1 className="mt-3 text-3xl font-semibold text-slate-950">
                    {image.originalName}
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    {image.description || 'No description added yet.'}
                  </p>
                </div>
                <div className="rounded-[1.6rem] bg-slate-950 px-5 py-4 text-white">
                  <div className="text-sm text-slate-300">Owner</div>
                  <div className="mt-1 font-medium">
                    {image.owner.name || image.owner.email}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-500">
                <span>{image.contributors.length} contributors</span>
                <span>{completedCount} completed</span>
                <span>{image.tags.length} tagged</span>
                {image.shareToNetwork && <span>Shared to network</span>}
              </div>

              {image.canManage && (
                <div className="mt-6 rounded-[1.8rem] border border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">
                        Network sharing
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Let accepted friends see this Ember in their feed.
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={shareToNetwork}
                        onChange={(event) => setShareToNetwork(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        Share to network
                      </span>
                    </label>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={handleShareSave}
                      disabled={savingShareState || shareToNetwork === image.shareToNetwork}
                      className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {savingShareState ? 'Saving...' : 'Save'}
                    </button>
                    {shareError && <span className="text-sm text-rose-600">{shareError}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>

          <TagManager
            imageId={image.id}
            tags={image.tags}
            contributors={image.contributors.map((contributor) => ({
              id: contributor.id,
              name: contributor.name,
              email: contributor.email,
              userId: contributor.userId,
            }))}
            friends={image.friends}
            canManage={image.canManage}
            onUpdate={fetchImage}
          />
        </div>

        <div>
          {image.canManage ? (
            <ContributorList
              imageId={image.id}
              contributors={image.contributors}
              friends={image.friends}
              onUpdate={fetchImage}
            />
          ) : (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">Contributors</h2>
              <p className="mt-2 text-sm text-slate-600">
                These are the people connected to this Ember.
              </p>
              <div className="mt-6 space-y-3">
                {image.contributors.length === 0 ? (
                  <p className="text-sm text-slate-500">No contributors have been added yet.</p>
                ) : (
                  image.contributors.map((contributor) => (
                    <div
                      key={contributor.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="font-medium text-slate-950">
                        {contributor.name ||
                          contributor.user?.name ||
                          contributor.email ||
                          contributor.phoneNumber ||
                          'Contributor'}
                      </div>
                      {(contributor.email || contributor.phoneNumber) && (
                        <div className="mt-1 text-sm text-slate-500">
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
