'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Image {
  id: string;
  filename: string;
  originalName: string;
  description: string | null;
  createdAt: string;
  _count: {
    contributors: number;
  };
  wiki: { id: string } | null;
}

export default function ImageGallery() {
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/images')
      .then((res) => res.json())
      .then((data) => {
        setImages(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center text-gray-500 py-8">Loading...</div>;
  }

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="mt-16">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
        Your Images
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {images.map((image) => (
          <Link
            key={image.id}
            href={`/image/${image.id}`}
            className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow"
          >
            <img
              src={`/api/uploads/${image.filename}`}
              alt={image.originalName}
              className="w-full h-40 object-cover"
            />
            <div className="p-4">
              <h3 className="font-medium text-gray-900 dark:text-white truncate">
                {image.originalName}
              </h3>
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{image._count.contributors} contributors</span>
                {image.wiki && (
                  <span className="text-green-600 dark:text-green-400">Wiki ready</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
