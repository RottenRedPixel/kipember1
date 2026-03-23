import ImageGallery from '@/components/ImageGallery';

export default function FeedPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <section>
        <ImageGallery />
      </section>
    </div>
  );
}
