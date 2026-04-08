import ImageUploader from '@/components/ImageUploader';

export default function CreatePage() {
  return (
    <div className="flex h-[calc(100dvh-2.7rem)] min-h-[calc(100dvh-2.7rem)] flex-col bg-white">
      <section id="add-ember" className="min-h-0 basis-[70%] bg-white px-6 pt-8 pb-10">
        <ImageUploader />
      </section>

      <section className="min-h-0 basis-[30%] bg-[var(--ember-orange)] px-11 py-8 text-white">
        <p className="max-w-[15rem] text-[1.08rem] font-medium leading-[1.28] tracking-[-0.03em]">
          Ember is a new way to collect and preserve your precious memories.
        </p>

        <div className="mt-8 flex items-center justify-between">
          <a href="/support" className="text-[0.98rem] font-semibold underline underline-offset-4">
            learn more
          </a>

          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(0,0,0,0.9)] text-[0.68rem] font-semibold tracking-[0.04em] text-white">
            DEMO
          </span>
        </div>
      </section>
    </div>
  );
}
