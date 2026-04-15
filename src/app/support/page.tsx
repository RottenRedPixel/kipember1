import type { Metadata } from 'next';
import Link from 'next/link';
import EmberBrand from '@/components/EmberBrand';

export const metadata: Metadata = {
  title: 'Support | Ember',
  description:
    'Support information for Ember, including common issues and contact guidance.',
};

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null;

const faqItems = [
  {
    title: 'Sign-in and account access',
    body:
      'Use the same email or phone number you used when you created your Ember account. If you were invited into a memory, open the invite link again and follow the sign-in flow tied to that invite.',
  },
  {
    title: 'Uploads not appearing',
    body:
      'Check your connection, then retry the upload. Large photos and videos may take a little longer to process because Ember extracts metadata and generates memory context after upload.',
  },
  {
    title: 'Contributor or Story Circle issues',
    body:
      'Make sure the contributor email or phone number is correct. Owners can resend or update contributor details from the memory management flows.',
  },
  {
    title: 'Voice interview support',
    body:
      'Voice interviews depend on the deployment configuration for telephony. If a contributor call does not start, confirm the phone number format and retry once the service is available.',
  },
  {
    title: 'Accessibility',
    body:
      'If a screen is difficult to use with VoiceOver, Larger Text, or reduced motion, report the exact screen and steps so the hosted Ember experience can be improved quickly.',
  },
];

export default function SupportPage() {
  return (
    <main className="ember-page">
      <div className="mx-auto max-w-4xl px-3 pt-1 pb-4 sm:px-4 sm:pt-2 sm:pb-6">
        <header className="ember-panel rounded-[1.8rem] px-5 py-5 sm:px-6">
          <EmberBrand staticBrand subtitle="support" />
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link href="/" className="ember-button-secondary px-4">
              Home
            </Link>
            <Link href="/privacy" className="ember-button-secondary px-4">
              Privacy
            </Link>
          </div>
        </header>

        <section className="ember-panel mt-5 rounded-[2rem] px-5 py-6 sm:px-7">
          <p className="ember-eyebrow">Support</p>
          <h1 className="ember-heading mt-3 text-4xl text-[var(--ember-text)] sm:text-5xl">
            Help for Ember on iPhone and web
          </h1>
          <p className="ember-copy mt-5 text-base leading-8">
            Use this page as the public support URL for App Store Connect. It
            covers the most common user issues and gives reviewers a stable support
            reference.
          </p>
        </section>

        <section className="mt-5 grid gap-5">
          {faqItems.map((item) => (
            <article
              key={item.title}
              className="ember-panel rounded-[2rem] px-5 py-6 sm:px-7"
            >
              <h2 className="ember-heading text-3xl text-[var(--ember-text)]">
                {item.title}
              </h2>
              <p className="ember-copy mt-4 text-sm leading-7">{item.body}</p>
            </article>
          ))}

          <article
            id="accessibility"
            className="ember-panel rounded-[2rem] px-5 py-6 sm:px-7"
          >
            <h2 className="ember-heading text-3xl text-[var(--ember-text)]">
              Contact path
            </h2>
            {supportEmail ? (
              <p className="ember-copy mt-4 text-sm leading-7">
                Email support at{' '}
                <a
                  href={`mailto:${supportEmail}`}
                  className="font-semibold text-[var(--ember-orange-deep)]"
                >
                  {supportEmail}
                </a>
                .
              </p>
            ) : (
              <p className="ember-copy mt-4 text-sm leading-7">
                A dedicated support email has not been published in the current
                environment yet. Before App Store submission, set
                `NEXT_PUBLIC_SUPPORT_EMAIL` so this page includes a direct support
                contact.
              </p>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
