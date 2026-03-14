'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ContributorList from '@/components/ContributorList';

interface Image {
  id: string;
  filename: string;
  originalName: string;
  description: string | null;
  visibility: 'PUBLIC' | 'PRIVATE' | 'SHARED';
  createdAt: string;
  contributors: {
    id: string;
    phoneNumber: string;
    name: string | null;
    token: string;
    inviteSent: boolean;
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
  wiki: {
    id: string;
  } | null;
}

export default function ImagePage() {
  const params = useParams();
  const [image, setImage] = useState<Image | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visibility, setVisibility] = useState<Image['visibility']>('PRIVATE');
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
  const [visibilityError, setVisibilityError] = useState('');

  const fetchImage = useCallback(async () => {
    try {
      const response = await fetch(`/api/images/${params.id}`);
      if (!response.ok) {
        throw new Error('Image not found');
      }
      const data = await response.json();
      setImage(data);
      setVisibility(data.visibility);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchImage();
  }, [fetchImage]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !image) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Image not found'}</p>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  const completedCount = image.contributors.filter(
    (c) => c.conversation?.status === 'completed'
  ).length;

  const handleVisibilitySave = async () => {
    setIsSavingVisibility(true);
    setVisibilityError('');
    try {
      const response = await fetch(`/api/images/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update visibility');
      }
      const updated = await response.json();
      setImage((prev) => (prev ? { ...prev, visibility: updated.visibility } : prev));
    } catch (err) {
      setVisibilityError(err instanceof Error ? err.message : 'Failed to update visibility');
    } finally {
      setIsSavingVisibility(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            &larr; Back
          </Link>
          <div className="flex gap-3">
            {image.wiki && (
              <Link
                href={`/image/${image.id}/wiki`}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                View Wiki
              </Link>
            )}
            <Link
              href={`/image/${image.id}/chat`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Chat with Image
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Section */}
          <div>
            <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800">
              <img
                src={`/api/uploads/${image.filename}`}
                alt={image.originalName}
                className="w-full h-80 object-contain bg-gray-100 dark:bg-gray-800"
              />
              <div className="p-4">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {image.originalName}
                </h1>
                {image.description && (
                  <p className="text-gray-600 dark:text-gray-400">
                    {image.description}
                  </p>
                )}
                <div className="mt-4 flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>{image.contributors.length} contributors</span>
                  <span>{completedCount} completed</span>
                </div>
                <div className="mt-5 border-t border-gray-200 dark:border-gray-800 pt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Visibility
                  </label>
                  <div className="flex flex-col gap-3">
                    <select
                      value={visibility}
                      onChange={(e) =>
                        setVisibility(e.target.value as Image['visibility'])
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="PRIVATE">Private (only you)</option>
                      <option value="SHARED">Shared (invite-only)</option>
                      <option value="PUBLIC">Public (searchable)</option>
                    </select>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleVisibilitySave}
                        disabled={isSavingVisibility || visibility === image.visibility}
                        className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {isSavingVisibility ? 'Saving...' : 'Save'}
                      </button>
                      {visibilityError && (
                        <span className="text-sm text-red-500">{visibilityError}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contributor Management */}
          <div>
            <ContributorList
              imageId={image.id}
              contributors={image.contributors}
              onUpdate={fetchImage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
