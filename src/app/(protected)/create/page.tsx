import EmberExplainerPanel from '@/components/EmberExplainerPanel';
import ImageUploader from '@/components/ImageUploader';

export default function CreatePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col px-3 pt-1 pb-6 sm:px-4 sm:pt-2 sm:pb-10">
      <section id="add-ember">
        <ImageUploader />
      </section>
      <EmberExplainerPanel learnMoreHref="/support" />
    </div>
  );
}
