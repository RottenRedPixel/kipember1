import Link from 'next/link';

export default function EmberExplainerPanel({
  learnMoreHref,
}: {
  learnMoreHref: string;
}) {
  return (
    <section className="ember-panel rounded-[2rem] p-6 sm:p-7">
      <p className="ember-eyebrow">What Ember does</p>
      <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)] sm:text-4xl">
        Ember is a tool that lets you preserve memories through shared, thoughtful conversations.
      </h2>
      <p className="ember-copy mt-4 max-w-2xl text-sm">
        Start with a photo or video, invite the people who lived the moment with you,
        and let Ember turn scattered recollection into one living memory.
      </p>
      <div className="mt-6">
        <Link href={learnMoreHref} className="ember-button-secondary px-5">
          Learn more
        </Link>
      </div>
    </section>
  );
}
