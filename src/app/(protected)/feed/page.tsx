import ImageGallery from '@/components/ImageGallery';
import ImageUploader from '@/components/ImageUploader';

export default function FeedPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="rounded-[2.4rem] border border-white/85 bg-white/85 p-8 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
            Your Ember Feed
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            Build living memory spaces around the photos that matter.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
            Upload a new Ember, invite contributors from your network, share it to
            friends when you want, and let the wiki keep growing as more stories come in.
          </p>
        </div>

        <div className="rounded-[2.4rem] border border-white/85 bg-white/85 p-6 shadow-sm backdrop-blur">
          <ImageUploader />
        </div>
      </section>

      <ImageGallery />
    </div>
  );
}
