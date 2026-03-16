import Link from 'next/link';
import { redirect } from 'next/navigation';
import EmberBrand from '@/components/EmberBrand';
import { getCurrentAuth } from '@/lib/auth-server';

const featureCards = [
  {
    eyebrow: 'Owner flow',
    title: 'Photo-led workspaces',
    copy:
      'Every Ember starts as a focused media workspace with lightweight story tools, contribution management, and sharing controls.',
  },
  {
    eyebrow: 'Contributor flow',
    title: 'Invites that feel personal',
    copy:
      'People can reply by text or call, and Ember keeps those responses inside the same evolving memory instead of scattering them.',
  },
  {
    eyebrow: 'Tend Ember',
    title: 'Role-aware controls',
    copy:
      'Owners get full stewardship. Contributors see a simpler, elegant subset of actions that still feels part of the same system.',
  },
];

export default async function LandingPage() {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect('/feed');
  }

  return (
    <main className="ember-page">
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <header className="ember-panel flex items-center justify-between rounded-full px-4 py-3">
          <EmberBrand subtitle="living memory system" />
          <div className="flex items-center gap-3">
            <Link href="/login" className="ember-button-secondary px-4">
              Login
            </Link>
            <Link href="/signup" className="ember-button-primary px-4">
              Create account
            </Link>
          </div>
        </header>

        <section className="grid gap-10 py-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <div className="ember-chip text-[0.74rem] uppercase tracking-[0.16em] text-[var(--ember-orange-deep)]">
              Sleek, simple memory collaboration
            </div>
            <h1 className="ember-heading mt-8 max-w-3xl text-5xl text-[var(--ember-text)] sm:text-6xl lg:text-7xl">
              Turn every photo into an Ember people can help remember.
            </h1>
            <p className="ember-copy mt-6 max-w-2xl text-lg">
              Upload a photo or video, let Ember build the first understanding of the
              moment, then invite the people who can add what the camera missed.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link href="/signup" className="ember-button-primary px-6">
                Start your first Ember
              </Link>
              <Link href="/login" className="ember-button-secondary px-6">
                I already have an account
              </Link>
            </div>

            <div className="mt-8 grid gap-3 text-sm text-[var(--ember-muted)] sm:grid-cols-2">
              <div className="ember-card rounded-[1.5rem] px-5 py-4">
                Auto-generated wiki, scene understanding, and conversation memory.
              </div>
              <div className="ember-card rounded-[1.5rem] px-5 py-4">
                Text and voice invites that keep every story fragment attached to the Ember.
              </div>
            </div>
          </div>

          <div className="ember-panel-strong relative overflow-hidden rounded-[2rem] p-5">
            <div className="absolute right-6 top-6 h-28 w-28 rounded-full bg-[rgba(255,102,33,0.1)] blur-3xl" />
            <div className="grid gap-4">
              <div className="rounded-[1.75rem] bg-[var(--ember-charcoal)] p-5 text-white">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-white/60">
                  <span>Owner workspace</span>
                  <span>Friends Night Out</span>
                </div>
                <div className="mt-5 overflow-hidden rounded-[1.5rem] bg-[linear-gradient(160deg,#6a736d_0%,#303432_100%)] p-5">
                  <div className="relative h-44">
                    <div className="absolute left-[17%] bottom-0 h-24 w-16 rounded-[999px_999px_32px_32px] bg-white/85 before:absolute before:left-1/2 before:top-[-1.3rem] before:h-5 before:w-5 before:-translate-x-1/2 before:rounded-full before:bg-white/85 before:content-['']" />
                    <div className="absolute left-1/2 bottom-0 h-32 w-20 -translate-x-1/2 rounded-[999px_999px_32px_32px] bg-white/90 before:absolute before:left-1/2 before:top-[-1.5rem] before:h-6 before:w-6 before:-translate-x-1/2 before:rounded-full before:bg-white/90 before:content-['']" />
                    <div className="absolute right-[17%] bottom-0 h-24 w-16 rounded-[999px_999px_32px_32px] bg-white/85 before:absolute before:left-1/2 before:top-[-1.3rem] before:h-5 before:w-5 before:-translate-x-1/2 before:rounded-full before:bg-white/85 before:content-['']" />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="ember-chip border-0 bg-white/12 text-white">Ask Ember</span>
                  <span className="ember-chip border-0 bg-white/12 text-white">Play Ember</span>
                  <span className="ember-chip border-0 bg-white/12 text-white">Contributors</span>
                  <span className="ember-chip border-0 bg-white/12 text-white">Share</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="ember-card rounded-[1.75rem] p-5">
                  <p className="ember-eyebrow">Contributor invite</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--ember-muted)]">
                    Hello Seth, help Amado build the story around this photo. Reply by text
                    or request a call from Ember.
                  </p>
                </div>
                <div className="ember-card rounded-[1.75rem] p-5">
                  <p className="ember-eyebrow">Thank-you state</p>
                  <h2 className="ember-heading mt-3 text-2xl">Thanks, Seth.</h2>
                  <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">
                    Your story fragment is now part of the memory and visible to the owner.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 pb-10 md:grid-cols-3">
          {featureCards.map((card) => (
            <article key={card.title} className="ember-panel rounded-[2rem] p-6">
              <p className="ember-eyebrow">{card.eyebrow}</p>
              <h2 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">
                {card.title}
              </h2>
              <p className="ember-copy mt-4 text-sm">{card.copy}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
