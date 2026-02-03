import ImageUploader from '@/components/ImageUploader';
import ImageGallery from '@/components/ImageGallery';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-black">
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Memory Wiki
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Transform your photos into living memories. Upload an image, invite
            contributors to share their stories, and create an interactive wiki
            you can talk to.
          </p>
          <div className="mt-6">
            <Link
              href="/wiki"
              className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-800 rounded-full text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Browse public wikis
            </Link>
          </div>
        </div>

        <ImageUploader />

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center p-6">
            <div className="text-4xl mb-4">📱</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              SMS Interviews
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Contributors receive an SMS and share their memories through a
              friendly AI conversation
            </p>
          </div>

          <div className="text-center p-6">
            <div className="text-4xl mb-4">📚</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Auto-Generated Wiki
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              All responses are synthesized into a rich, structured wiki entry
              about your memory
            </p>
          </div>

          <div className="text-center p-6">
            <div className="text-4xl mb-4">💬</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Interactive Chat
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Ask questions about the memory and get answers from the collected
              stories
            </p>
          </div>
        </div>

        <ImageGallery />
      </main>
    </div>
  );
}
