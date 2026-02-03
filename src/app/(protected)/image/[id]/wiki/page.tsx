'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import WikiView from '@/components/WikiView';

interface Wiki {
  id: string;
  content: string;
  version: number;
  updatedAt: string;
  image: {
    originalName: string;
    description: string | null;
    filename: string;
  };
}

export default function WikiPage() {
  const params = useParams();
  const [wiki, setWiki] = useState<Wiki | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const fetchWiki = async () => {
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
  };

  useEffect(() => {
    fetchWiki();
  }, [params.id]);

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href={`/image/${params.id}`}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            &larr; Back to Image
          </Link>
          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg font-medium transition-colors"
            >
              {generating ? 'Generating...' : wiki ? 'Regenerate Wiki' : 'Generate Wiki'}
            </button>
            <Link
              href={`/image/${params.id}/chat`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Chat with Image
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {wiki ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-800">
            {wiki.image && (
              <div className="mb-8 flex items-center gap-4">
                <img
                  src={`/api/uploads/${wiki.image.filename}`}
                  alt={wiki.image.originalName}
                  className="w-24 h-24 object-cover rounded-lg"
                />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {wiki.image.originalName}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Version {wiki.version} &bull; Updated{' '}
                    {new Date(wiki.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
            <WikiView content={wiki.content} />
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-12 shadow-sm border border-gray-200 dark:border-gray-800 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Wiki Yet
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Once contributors complete their interviews, you can generate a wiki
              that synthesizes all their memories.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg font-medium transition-colors"
            >
              {generating ? 'Generating...' : 'Generate Wiki'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
