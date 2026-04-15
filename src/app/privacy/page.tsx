import type { Metadata } from 'next';
import Link from 'next/link';
import EmberBrand from '@/components/EmberBrand';

export const metadata: Metadata = {
  title: 'Privacy | Ember',
  description:
    'Privacy information for Ember, including the data used to create and preserve shared memories.',
};

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null;

const collectionItems = [
  'Account information such as name, email address, and optional phone number.',
  'Photos, videos, captions, tags, and other memory content you upload.',
  'Contributor contact details you enter so you can invite other people into a memory.',
  'Text responses, chat messages, voice transcripts, and call summaries connected to a memory.',
  'Photo metadata that may include capture time or location when it is embedded in an uploaded file.',
];

const useItems = [
  'Provide account access and keep a shared memory archive tied to the right people.',
  'Generate wiki pages, kids stories, chat responses, and other memory outputs from the content you submit.',
  'Support contributor invitations, voice interviews, and ongoing collaboration around a memory.',
  'Secure and maintain the service, including session management and access control.',
];

const sharingItems = [
  'Content is shared with the people you invite into a memory and with the account owner managing that memory.',
  'If you choose to make a memory public, the content you mark as public can be visible more broadly.',
  'Depending on deployment, content may be processed by service providers used for AI generation, telephony, email delivery, and hosting.',
];

export default function PrivacyPage() {
  return (
    <main className="ember-page">
      <div className="mx-auto max-w-4xl px-3 pt-1 pb-4 sm:px-4 sm:pt-2 sm:pb-6">
        <header className="ember-panel rounded-[1.8rem] px-5 py-5 sm:px-6">
          <EmberBrand staticBrand subtitle="privacy policy" />
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link href="/" className="ember-button-secondary px-4">
              Home
            </Link>
            <Link href="/support" className="ember-button-secondary px-4">
              Support
            </Link>
          </div>
        </header>

        <section className="ember-panel mt-5 rounded-[2rem] px-5 py-6 sm:px-7">
          <p className="ember-eyebrow">Privacy</p>
          <h1 className="ember-heading mt-3 text-4xl text-[var(--ember-text)] sm:text-5xl">
            How Ember handles memory data
          </h1>
          <p className="ember-copy mt-5 text-base leading-8">
            Last updated March 21, 2026.
          </p>
          <p className="ember-copy mt-4 text-base leading-8">
            Ember is designed to help people preserve memories together. That means
            the app stores and processes the content you submit so it can keep one
            memory connected across uploads, contributors, and generated story
            views.
          </p>
        </section>

        <section className="mt-5 grid gap-5">
          <article className="ember-panel rounded-[2rem] px-5 py-6 sm:px-7">
            <h2 className="ember-heading text-3xl text-[var(--ember-text)]">
              What Ember collects
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--ember-muted)]">
              {collectionItems.map((item) => (
                <li key={item} className="ember-card rounded-[1.4rem] px-4 py-4">
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="ember-panel rounded-[2rem] px-5 py-6 sm:px-7">
            <h2 className="ember-heading text-3xl text-[var(--ember-text)]">
              What Ember uses that data for
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--ember-muted)]">
              {useItems.map((item) => (
                <li key={item} className="ember-card rounded-[1.4rem] px-4 py-4">
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="ember-panel rounded-[2rem] px-5 py-6 sm:px-7">
            <h2 className="ember-heading text-3xl text-[var(--ember-text)]">
              Sharing and processors
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--ember-muted)]">
              {sharingItems.map((item) => (
                <li key={item} className="ember-card rounded-[1.4rem] px-4 py-4">
                  {item}
                </li>
              ))}
            </ul>
            <p className="ember-copy mt-5 text-sm leading-7">
              The current codebase does not include third-party advertising SDKs in
              the iPhone shell, and it is not set up for cross-app tracking.
            </p>
          </article>

          <article className="ember-panel rounded-[2rem] px-5 py-6 sm:px-7">
            <h2 className="ember-heading text-3xl text-[var(--ember-text)]">
              Access, updates, and deletion
            </h2>
            <p className="ember-copy mt-5 text-sm leading-7">
              You can update core account details from your profile inside Ember.
              If you need help with a privacy or deletion request, use the support
              page and the contact path published there.
            </p>
            {supportEmail ? (
              <p className="ember-copy mt-4 text-sm leading-7">
                Current privacy contact:{' '}
                <a
                  href={`mailto:${supportEmail}`}
                  className="font-semibold text-[var(--ember-orange-deep)]"
                >
                  {supportEmail}
                </a>
              </p>
            ) : null}
          </article>
        </section>
      </div>
    </main>
  );
}
