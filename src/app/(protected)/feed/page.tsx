import ImageGallery from '@/components/ImageGallery';
import ImageUploader from '@/components/ImageUploader';

export default function FeedPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <section>
        <ImageUploader />
      </section>

      <section className="mt-8">
        <ImageGallery />
      </section>
    </div>
  );
}
