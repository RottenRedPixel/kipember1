import Link from 'next/link';

export default function EmberExplainerPanel({
  learnMoreHref,
}: {
  learnMoreHref: string;
}) {
  return (
    <section className="ember-panel rounded-[2rem] p-6 sm:p-7">
      <h2 className="ember-heading text-3xl text-[var(--ember-text)] sm:text-4xl">
        Capture life&apos;s moments together and relive them anytime.
      </h2>
      <p className="ember-copy mt-4 max-w-2xl text-sm">
        Through simple, AI-guided conversations, Ember creates interactive memories
        that grow over time.
      </p>
      <div className="mt-6">
        <Link href={learnMoreHref} className="ember-button-secondary px-5">
          Learn more
        </Link>
      </div>
    </section>
  );
}
