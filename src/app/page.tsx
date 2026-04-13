import Link from 'next/link';
import { redirect } from 'next/navigation';
import GuestImageUploader from '@/components/GuestImageUploader';
import HeaderMenu from '@/components/HeaderMenu';
import { getCurrentAuth } from '@/lib/auth-server';

const featureRows = [
  {
    title: 'Shared by default',
    body: 'Invite family and friends to add the details, voices, and reactions you would lose in a camera roll.',
  },
  {
    title: 'Guided by Ember',
    body: 'The conversation flow pulls out what happened, why it mattered, and what each person remembers differently.',
  },
  {
    title: 'Built to keep growing',
    body: 'Each upload becomes a living memory page you can revisit, tend, share, and expand later.',
  },
];

export default async function LandingPage() {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect('/create');
  }

  return (
    <main className="ember-page">
      <div className="ember-app-shell">
        <header className="ember-topbar sticky top-0 z-40">
          <div className="flex h-[2.7rem] items-center justify-between px-4 text-[0.78rem] font-semibold tracking-[0.16em] text-white">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-white">
                HOME
              </Link>
              <span className="text-white/45">EMBERS</span>
            </div>

            <HeaderMenu
              authMode="signed-out"
              className="text-white/55 hover:text-white"
              iconClassName="h-[0.95rem] w-[0.95rem]"
              panelClassName="right-0 top-[calc(100%+0.35rem)] min-w-[8.5rem] rounded-[1.1rem] border border-white/10 bg-[rgba(8,8,8,0.92)] p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.34)]"
            />
          </div>
        </header>

        <section className="relative min-h-[calc(100vh-2.7rem)] px-4 pt-6 pb-6 lg:px-6 lg:py-8">
          <div className="flex flex-col gap-6 lg:min-h-[calc(100vh-4.7rem)] lg:justify-between">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(24rem,32rem)] lg:items-start">
              <div className="space-y-5 lg:max-w-[39rem] lg:pt-3">
                <span className="ember-stage-pill">Living memory system</span>

                <div className="space-y-4">
                  <h1 className="max-w-[19rem] text-[2.9rem] font-bold leading-[0.94] tracking-[-0.06em] text-white sm:max-w-[24rem] lg:max-w-[38rem] lg:text-[4.4rem]">
                    Start with the image. Keep the whole memory.
                  </h1>
                  <p className="max-w-[20rem] text-[0.98rem] leading-7 text-white/64 sm:max-w-[27rem] lg:max-w-[34rem] lg:text-[1.02rem]">
                    Ember turns a photo or video into a shared memory space with guided prompts,
                    contributor interviews, and a living page that keeps evolving.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:max-w-[31rem]">
                  <Link href="/signup" className="ember-button-primary w-full">
                    Create account
                  </Link>
                  <Link href="/login" className="ember-button-secondary w-full">
                    Log in
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[0.82rem] text-white/46">
                  <Link href="/support" className="hover:text-white">
                    Support
                  </Link>
                  <Link href="/privacy" className="hover:text-white">
                    Privacy
                  </Link>
                </div>
              </div>

              <section className="ember-stage-section overflow-hidden px-4 py-5 lg:sticky lg:top-[4.35rem] lg:px-5 lg:py-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white/44">
                      Welcome
                    </p>
                    <h2 className="mt-2 text-[1.55rem] font-semibold tracking-[-0.05em] text-white">
                      Upload the first moment
                    </h2>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/62">
                    Photo or video
                  </span>
                </div>

                <p className="mt-3 max-w-[19rem] text-sm leading-6 text-white/58 sm:max-w-[24rem] lg:max-w-[26rem]">
                  This starts the same full-screen Ember flow used across the rest of the app.
                </p>

                <div className="mt-5">
                  <GuestImageUploader />
                </div>
              </section>
            </div>

            <section className="grid gap-3 lg:grid-cols-3">
              {featureRows.map((row) => (
                <article key={row.title} className="ember-stage-section px-4 py-4 lg:px-5 lg:py-5">
                  <h3 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-white">
                    {row.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/58">{row.body}</p>
                </article>
              ))}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
