'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

interface WikiResult {
  id: string;
  content: string;
  updatedAt: string;
  image: {
    id: string;
    originalName: string;
    description: string | null;
    filename: string;
  };
}

export default function PublicWikiIndex() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WikiResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWikis = async (nextQuery: string) => {
    setLoading(true);
    setError('');
    try {
      const url = nextQuery
        ? `/api/public/wikis?q=${encodeURIComponent(nextQuery)}`
        : '/api/public/wikis';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to load wikis');
      }
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wikis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWikis('');
  }, []);

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWikis(trimmedQuery);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Public Memory Wikis
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Search the memories that have been shared publicly.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            &larr; Back home
          </Link>
        </div>

        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by keyword, name, or description..."
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Search
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-gray-500 text-center py-8">Loading...</div>
        ) : results.length === 0 ? (
          <div className="text-gray-500 text-center py-12">
            {trimmedQuery ? 'No public wikis matched your search.' : 'No public wikis yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((wiki) => {
              const preview = wiki.content.replace(/\s+/g, ' ').slice(0, 140);
              return (
                <Link
                  key={wiki.id}
                  href={`/image/${wiki.image.id}/wiki`}
                  className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow"
                >
                  <img
                    src={`/api/uploads/${wiki.image.filename}`}
                    alt={wiki.image.originalName}
                    className="w-full h-40 object-cover"
                  />
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {wiki.image.originalName}
                    </h3>
                    {wiki.image.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {wiki.image.description}
                      </p>
                    )}
                    {preview && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 line-clamp-2">
                        {preview}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
