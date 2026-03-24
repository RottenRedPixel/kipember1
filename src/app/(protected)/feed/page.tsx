import ImageGallery from '@/components/ImageGallery';

export default function FeedPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col px-3 py-3 sm:px-4 sm:py-4">
      <section>
        <ImageGallery />
      </section>
    </div>
  );
}
