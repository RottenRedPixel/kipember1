import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import EmberBrand from '@/components/EmberBrand';
import EmberExplainerPanel from '@/components/EmberExplainerPanel';
import EmberMobileTopBar from '@/components/EmberMobileTopBar';
import { getCurrentAuth } from '@/lib/auth-server';

const memoryPrinciples = [
  {
    eyebrow: 'What happened',
    title: 'Shared reflection',
    copy:
      'Ember gathers multiple voices around one photo, one place, or one piece of family history so the record feels fuller than a caption.',
  },
  {
    eyebrow: 'How it felt',
    title: 'Real voices',
    copy:
      'Stories can come in by text or call, so the emotional tone of the memory stays intact instead of getting flattened into a note.',
  },
  {
    eyebrow: 'Why it mattered',
    title: 'Living archive',
    copy:
      'Every response stays connected to the same Ember, giving the memory more shape as new people and details are added over time.',
  },
];

const archiveSteps = [
  {
    step: '01',
    title: 'Start with a moment',
    copy:
      'A photo, a video, a place, or a story prompt becomes the Ember people gather around.',
  },
  {
    step: '02',
    title: 'Open the Story Circle',
    copy:
      'Invite friends and family to reflect together so Ember can preserve not just facts, but reactions, voices, and perspective.',
  },
  {
    step: '03',
    title: 'Keep it alive',
    copy:
      'The memory keeps evolving as more voices, follow-ups, and context are added back into the same archive.',
  },
];

const archiveSignals = [
  'Photos and videos become shared memory spaces.',
  'Contributors reply by text or by voice.',
  'Ember turns scattered recollection into one living record.',
];

export default async function LandingPage() {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect('/feed');
  }

  return (
    <main className="ember-page">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] bg-[radial-gradient(circle_at_top_right,rgba(255,102,33,0.16),transparent_38%),radial-gradient(circle_at_top_left,rgba(20,20,20,0.05),transparent_28%)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header>
          <div className="ember-panel hidden items-center justify-between rounded-full px-5 py-4 sm:flex">
            <EmberBrand subtitle="living memory companion" />
            <div className="flex items-center gap-3">
              <Link href="/login" className="ember-button-secondary px-5">
                Login
              </Link>
              <Link href="/signup" className="ember-button-primary px-5">
                Create account
              </Link>
            </div>
          </div>

          <EmberMobileTopBar
            homeHref="/"
            embersHref="/feed"
            addHref="/signup"
            accountHref="/access"
          />
        </header>

        <section className="grid gap-5 py-8 lg:grid-cols-[1.04fr_0.96fr] lg:items-stretch">
          <Link
            id="add-ember"
            href="/signup"
            className="group flex min-h-[20rem] flex-col items-center justify-center rounded-[2rem] border border-dashed border-[rgba(20,20,20,0.12)] bg-white/78 px-6 py-10 text-center shadow-[0_16px_34px_rgba(17,17,17,0.05)] sm:px-8"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-[rgba(255,102,33,0.08)]">
              <Image src="/emberfav.svg" alt="" width={28} height={28} priority />
            </div>
            <p className="ember-eyebrow mt-6">Start a memory</p>
            <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)] sm:text-4xl">
              Drop a photo or video
            </h2>
            <p className="ember-copy mx-auto mt-3 max-w-2xl text-sm">
              Create an account, add the moment, and let Ember start shaping it into a shared memory.
            </p>
            <span className="mt-6 inline-flex rounded-full bg-[var(--ember-charcoal)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(17,17,17,0.16)] transition group-hover:-translate-y-0.5">
              Create your first Ember
            </span>
          </Link>

          <EmberExplainerPanel learnMoreHref="#learn-more" />
        </section>

        <section
          id="learn-more"
          className="grid gap-8 py-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:py-16"
        >
          <div>
            <div className="inline-flex rounded-full border border-[rgba(255,102,33,0.14)] bg-white/88 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--ember-orange-deep)] shadow-[0_12px_30px_rgba(17,17,17,0.05)]">
              Hi, this is Ember
            </div>

            <h1 className="ember-heading mt-7 max-w-4xl text-5xl leading-[0.96] text-[var(--ember-text)] sm:text-6xl lg:text-7xl">
              Preserve the memory with the people who lived it.
            </h1>

            <p className="ember-copy mt-6 max-w-2xl text-lg leading-8">
              Ember is an AI-guided companion that helps you preserve memories
              through shared, thoughtful conversations with friends and family.
            </p>

            <p className="ember-copy mt-4 max-w-2xl text-base leading-8">
              It records the real voices of the people who gather to reflect on a
              moment, capturing what happened, how it felt, and what it meant to
              everyone.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link href="/signup" className="ember-button-primary px-6">
                Start your first Ember
              </Link>
              <Link href="/login" className="ember-button-secondary px-6">
                I already have an account
              </Link>
            </div>

            <div className="mt-10 grid gap-3 text-sm text-[var(--ember-muted)] sm:grid-cols-3">
              {archiveSignals.map((signal) => (
                <div key={signal} className="ember-card rounded-[1.5rem] px-4 py-4 leading-7">
                  {signal}
                </div>
              ))}
            </div>
          </div>

          <div className="ember-panel-strong relative overflow-hidden rounded-[2.4rem] p-5 sm:p-6">
            <div className="absolute -right-10 top-6 h-44 w-44 rounded-full bg-[rgba(255,102,33,0.14)] blur-3xl" />
            <div className="absolute left-8 top-10 h-24 w-24 rounded-full border border-[rgba(255,255,255,0.46)] bg-white/12" />

            <div className="relative grid gap-4">
              <div className="rounded-[2rem] bg-[var(--ember-charcoal)] px-5 py-5 text-white shadow-[0_18px_40px_rgba(17,17,17,0.18)]">
                <div className="flex items-center justify-between text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/62">
                  <span>The Story Circle</span>
                  <span>Shared conversation</span>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="max-w-[88%] rounded-[1.4rem] bg-white/10 px-4 py-3">
                    <div className="text-[0.65rem] uppercase tracking-[0.16em] text-white/56">
                      Owner prompt
                    </div>
                    <p className="mt-2 text-sm leading-7 text-white/90">
                      Tell me what everybody remembers about that night by the lake.
                    </p>
                  </div>

                  <div className="ml-auto max-w-[85%] rounded-[1.4rem] bg-white px-4 py-3 text-[var(--ember-text)]">
                    <div className="text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ember-muted)]">
                      Family response
                    </div>
                    <p className="mt-2 text-sm leading-7">
                      Dad remembers the storm rolling in. Your sister remembers laughing
                      through it. Ember keeps both.
                    </p>
                  </div>

                  <div className="max-w-[80%] rounded-[1.4rem] bg-[rgba(255,102,33,0.15)] px-4 py-3 text-white">
                    <div className="text-[0.65rem] uppercase tracking-[0.16em] text-white/62">
                      Ember thread
                    </div>
                    <p className="mt-2 text-sm leading-7 text-white/92">
                      What happened. How it felt. Why it still matters.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[0.95fr_1.05fr]">
                <div className="ember-card rounded-[1.8rem] px-5 py-5">
                  <p className="ember-eyebrow">Keep It Alive</p>
                  <h2 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">
                    One memory, still growing
                  </h2>
                  <p className="ember-copy mt-4 text-sm leading-7">
                    Ember connects every story into a living archive, evolving as new
                    memories, voices, and perspectives are added over time.
                  </p>
                </div>

                <div className="rounded-[1.8rem] border border-[rgba(20,20,20,0.08)] bg-[linear-gradient(160deg,rgba(255,255,255,0.96)_0%,rgba(248,244,240,0.92)_100%)] px-5 py-5 shadow-[0_12px_28px_rgba(17,17,17,0.06)]">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--ember-orange-deep)]">
                    Archive view
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-[1.25rem] border border-[var(--ember-line)] bg-white px-4 py-3">
                      <div className="text-sm font-semibold text-[var(--ember-text)]">
                        Photo
                      </div>
                      <div className="mt-1 text-sm text-[var(--ember-muted)]">
                        The porch after dinner
                      </div>
                    </div>
                    <div className="rounded-[1.25rem] border border-[var(--ember-line)] bg-white px-4 py-3">
                      <div className="text-sm font-semibold text-[var(--ember-text)]">
                        Voices
                      </div>
                      <div className="mt-1 text-sm text-[var(--ember-muted)]">
                        Mom, Theo, Ava, Grandpa
                      </div>
                    </div>
                    <div className="rounded-[1.25rem] border border-[var(--ember-line)] bg-white px-4 py-3">
                      <div className="text-sm font-semibold text-[var(--ember-text)]">
                        Meaning
                      </div>
                      <div className="mt-1 text-sm text-[var(--ember-muted)]">
                        The last summer before everyone moved away
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 pb-5 md:grid-cols-3">
          {memoryPrinciples.map((principle) => (
            <article key={principle.title} className="ember-panel rounded-[2rem] p-6">
              <p className="ember-eyebrow">{principle.eyebrow}</p>
              <h2 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">
                {principle.title}
              </h2>
              <p className="ember-copy mt-4 text-sm leading-7">{principle.copy}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-5 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="ember-panel rounded-[2.2rem] p-6 sm:p-7">
            <p className="ember-eyebrow">The Story Circle</p>
            <h2 className="ember-heading mt-4 max-w-xl text-4xl text-[var(--ember-text)] sm:text-5xl">
              Invite people into a memory without losing the thread.
            </h2>
            <p className="ember-copy mt-5 max-w-xl text-base leading-8">
              Invite others to join a group conversation about a time or place,
              preserving not just the stories, but the voices and reactions around
              them.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="ember-card rounded-[1.5rem] px-5 py-4">
                <div className="text-sm font-semibold text-[var(--ember-text)]">
                  Friends and family
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">
                  The people closest to the moment add context the camera cannot hold.
                </p>
              </div>
              <div className="ember-card rounded-[1.5rem] px-5 py-4">
                <div className="text-sm font-semibold text-[var(--ember-text)]">
                  Voice and text
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">
                  Contributors can respond in the way that feels most natural to them.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {archiveSteps.map((item) => (
              <article
                key={item.step}
                className="ember-card grid gap-4 rounded-[2rem] px-5 py-5 sm:grid-cols-[4.5rem_1fr] sm:items-start"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.3rem] bg-[rgba(255,102,33,0.1)] text-lg font-semibold text-[var(--ember-orange-deep)]">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--ember-text)]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--ember-muted)]">
                    {item.copy}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="pb-12 pt-6">
          <div className="overflow-hidden rounded-[2.4rem] bg-[var(--ember-charcoal)] px-6 py-8 text-white shadow-[0_24px_60px_rgba(17,17,17,0.18)] sm:px-8 sm:py-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-white/58">
                  Start preserving the memory now
                </p>
                <h2 className="ember-heading mt-4 max-w-3xl text-4xl text-white sm:text-5xl">
                  Build an archive that feels more human every time someone adds to it.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-white/72">
                  Create an Ember, invite the people who were there, and let the story
                  keep unfolding in one place.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/signup" className="ember-button-primary px-6">
                  Create account
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-[3.35rem] items-center justify-center rounded-full border border-white/18 px-6 text-sm font-medium text-white transition hover:bg-white/8"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
