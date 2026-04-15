import Link from 'next/link';

export default function EmberExplainerPanel({
  learnMoreHref,
}: {
  learnMoreHref: string;
}) {
  return (
    <section className="rounded-[1.9rem] bg-[#f5efeb] px-6 py-6 text-left">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--ember-orange-deep)]">
        The Vision
      </p>
      <h2 className="ember-heading mt-4 text-[2.05rem] font-semibold leading-[1.08] text-[var(--ember-text)]">
        Capture life&apos;s moments together and relive them anytime.
      </h2>
      <p className="ember-copy mt-3 text-[0.98rem] leading-7">
        Through simple, AI-guided conversations, Ember creates interactive memories
        that grow over time.
      </p>
      <div className="mt-6">
        <Link
          href={learnMoreHref}
          className="ember-button-primary min-h-[3rem] rounded-[1rem] px-5"
        >
          Learn more
        </Link>
      </div>
    </section>
  );
}
