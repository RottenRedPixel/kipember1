import ImageUploader from '@/components/ImageUploader';

export default function CreatePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col px-3 pt-1 pb-4 sm:px-4 sm:pt-2 sm:pb-6">
      <section id="add-ember">
        <ImageUploader />
      </section>
    </div>
  );
}
