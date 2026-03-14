'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ChatInterface from '@/components/ChatInterface';

interface Image {
  id: string;
  filename: string;
  originalName: string;
  description: string | null;
}

export default function ChatPage() {
  const params = useParams();
  const [image, setImage] = useState<Image | null>(null);
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

    fetchImage();
  }, [params.id]);

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
            href="/feed"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href={`/image/${params.id}`}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            &larr; Back to Image
          </Link>
          <Link
            href={`/image/${params.id}/wiki`}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            View Wiki
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Section */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800">
              <img
                src={`/api/uploads/${image.filename}`}
                alt={image.originalName}
                className="w-full h-80 object-contain bg-gray-100 dark:bg-gray-800"
              />
              <div className="p-4">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {image.originalName}
                </h1>
                {image.description && (
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    {image.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Chat Section */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Chat with this Memory
            </h2>
            <ChatInterface imageId={image.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
