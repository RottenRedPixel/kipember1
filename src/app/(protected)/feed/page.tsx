import ImageGallery from '@/components/ImageGallery';
import ImageUploader from '@/components/ImageUploader';

export default function FeedPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="ember-panel rounded-[2rem] p-8">
          <p className="ember-eyebrow">Owner home</p>
          <h1 className="ember-heading mt-4 text-4xl text-[var(--ember-text)]">
            Build living memory spaces around the moments that matter.
          </h1>
          <p className="ember-copy mt-4 max-w-2xl text-sm">
            Start a new Ember, invite contributors, and let the memory grow through
            scene context, story fragments, and shared access that stays elegant instead
            of chaotic.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="ember-chip">Upload media</span>
            <span className="ember-chip">Invite contributors</span>
            <span className="ember-chip">Generate wiki</span>
            <span className="ember-chip">Share when ready</span>
          </div>
        </div>

        <div className="ember-panel rounded-[2rem] p-6">
          <ImageUploader />
        </div>
      </section>

      <ImageGallery />
    </div>
  );
}
