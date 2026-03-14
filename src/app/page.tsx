import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';

const featureCards = [
  {
    eyebrow: 'Talk',
    title: 'Text or speak with Ember',
    copy:
      'Invite anyone to share memories through chat or Retell-powered calls, then fold those stories back into the same Ember.',
  },
  {
    eyebrow: 'Remember',
    title: 'Auto-build the memory wiki',
    copy:
      'Every upload gets visual analysis, metadata review, structured scene insights, and a living wiki that grows as people contribute.',
  },
  {
    eyebrow: 'Share',
    title: 'Grow your Ember network',
    copy:
      'Keep Embers private to your circle, share selected ones to friends, and quickly invite trusted people already in your network.',
  },
];

export default async function LandingPage() {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect('/feed');
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#fde68a_0%,rgba(253,230,138,0.15)_22%,transparent_50%),radial-gradient(circle_at_top_right,#bfdbfe_0%,rgba(191,219,254,0.2)_28%,transparent_56%),linear-gradient(180deg,#fffdf8_0%,#f8fbff_55%,#f7f2ff_100%)] text-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-700">
              Ember Archive
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Create account
            </Link>
          </div>
        </header>

        <section className="grid gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-800">
              Living photo stories
            </div>
            <h1 className="mt-8 max-w-3xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
              Turn every photo into an Ember people can help remember.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Upload a photo, let AI read the scene, invite friends and family to
              text or call Ember, and build a shared memory archive that feels
              alive instead of static.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Start your archive
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/85 px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
              >
                I already have an account
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-10 top-8 hidden h-28 w-28 rounded-full bg-amber-200/60 blur-3xl lg:block" />
            <div className="absolute -right-12 bottom-0 hidden h-36 w-36 rounded-full bg-sky-200/70 blur-3xl lg:block" />
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/80 bg-white/85 p-6 shadow-[0_40px_100px_rgba(15,23,42,0.14)] backdrop-blur">
              <div className="rounded-[2rem] bg-slate-950 p-6 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
                  Story Circle
                </p>
                <div className="mt-5 space-y-3">
                  <div className="max-w-[80%] rounded-[1.5rem] rounded-bl-md bg-white/12 px-4 py-3 text-sm leading-6">
                    Ember: Who is in this photo with you?
                  </div>
                  <div className="ml-auto max-w-[80%] rounded-[1.5rem] rounded-br-md bg-emerald-500 px-4 py-3 text-sm leading-6 text-white">
                    That’s my sister and our dad on the lake the summer before college.
                  </div>
                  <div className="max-w-[80%] rounded-[1.5rem] rounded-bl-md bg-white/12 px-4 py-3 text-sm leading-6">
                    Ember: Want to add any follow-up tidbits to what you shared last time?
                  </div>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.6rem] bg-amber-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                    Network sharing
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    Let trusted friends see selected Embers in a shared feed.
                  </p>
                </div>
                <div className="rounded-[1.6rem] bg-sky-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                    Auto wiki
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    Scene analysis, metadata, contributor memories, kids mode, and chat all stay connected.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 pb-12 md:grid-cols-3">
          {featureCards.map((card) => (
            <div
              key={card.title}
              className="rounded-[2rem] border border-white/80 bg-white/82 p-6 shadow-sm backdrop-blur"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                {card.eyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                {card.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {card.copy}
              </p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
