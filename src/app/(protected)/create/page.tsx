import ImageUploader from '@/components/ImageUploader';

export default function CreatePage() {
  return (
    <div className="min-h-[calc(100dvh-2.7rem)] px-4 pt-5 pb-6 text-white lg:px-6 lg:py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.94fr)_minmax(28rem,1.06fr)] lg:items-start">
        <div className="space-y-4 lg:sticky lg:top-[4.35rem] lg:max-w-[33rem]">
          <span className="ember-stage-pill">Create</span>
          <h1 className="max-w-[18rem] text-[2.35rem] font-semibold leading-[0.95] tracking-[-0.06em] sm:max-w-[24rem] lg:max-w-[30rem] lg:text-[4rem]">
            Turn a photo into a living Ember.
          </h1>
          <p className="max-w-[20rem] text-sm leading-7 text-white/58 sm:max-w-[28rem] lg:max-w-[31rem] lg:text-[1rem]">
            Upload the source image or video, then let Ember build the memory workspace,
            story circle, and share flow around it.
          </p>

          <section className="ember-stage-section grid gap-3 px-4 py-4 text-sm text-white/58 lg:px-5 lg:py-5">
            <p>
              Supports photos and short videos. Ember keeps the full-screen reference layout from
              upload through playback.
            </p>
            <a href="/support" className="font-semibold text-[var(--ember-orange-deep)] hover:text-white">
              Learn more
            </a>
          </section>
        </div>

        <section id="add-ember" className="ember-stage-section px-4 py-5 lg:px-6 lg:py-6">
          <ImageUploader />
        </section>
      </div>
    </div>
  );
}
