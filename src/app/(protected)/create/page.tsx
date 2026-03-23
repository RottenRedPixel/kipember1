import ImageUploader from '@/components/ImageUploader';

export default function CreatePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <section id="add-ember">
        <ImageUploader />
      </section>
    </div>
  );
}
