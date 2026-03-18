import EmberExplainerPanel from '@/components/EmberExplainerPanel';
import ImageGallery from '@/components/ImageGallery';
import ImageUploader from '@/components/ImageUploader';

export default function FeedPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <section id="add-ember" className="order-1">
        <ImageUploader />
      </section>

      <section className="order-2 mt-8 md:order-3">
        <ImageGallery />
      </section>

      <section className="order-3 mt-8 md:order-2">
        <EmberExplainerPanel learnMoreHref="/#learn-more" />
      </section>
    </div>
  );
}
