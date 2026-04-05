import Link from 'next/link';
import { redirect } from 'next/navigation';
import HeaderMenu from '@/components/HeaderMenu';
import { getCurrentAuth } from '@/lib/auth-server';

function EmberSparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-14 w-14 text-[var(--ember-orange)]" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="2.15" />
      <path d="M12 1.85c.56 0 1.02.46 1.02 1.02v3.43a1.02 1.02 0 1 1-2.04 0V2.87c0-.56.46-1.02 1.02-1.02Z" />
      <path d="M12 17.7c.56 0 1.02.46 1.02 1.02v3.43a1.02 1.02 0 0 1-2.04 0v-3.43c0-.56.46-1.02 1.02-1.02Z" />
      <path d="M1.85 12c0-.56.46-1.02 1.02-1.02H6.3a1.02 1.02 0 1 1 0 2.04H2.87c-.56 0-1.02-.46-1.02-1.02Z" />
      <path d="M17.7 12c0-.56.46-1.02 1.02-1.02h3.43a1.02 1.02 0 1 1 0 2.04h-3.43c-.56 0-1.02-.46-1.02-1.02Z" />
      <path d="M4.36 4.36a1.02 1.02 0 0 1 1.44 0l2.43 2.43a1.02 1.02 0 1 1-1.44 1.44L4.36 5.8a1.02 1.02 0 0 1 0-1.44Z" />
      <path d="M15.77 15.77a1.02 1.02 0 0 1 1.44 0l2.43 2.43a1.02 1.02 0 0 1-1.44 1.44l-2.43-2.43a1.02 1.02 0 0 1 0-1.44Z" />
      <path d="M19.64 4.36a1.02 1.02 0 0 1 0 1.44l-2.43 2.43a1.02 1.02 0 1 1-1.44-1.44l2.43-2.43a1.02 1.02 0 0 1 1.44 0Z" />
      <path d="M8.23 15.77a1.02 1.02 0 0 1 0 1.44L5.8 19.64a1.02 1.02 0 0 1-1.44-1.44l2.43-2.43a1.02 1.02 0 0 1 1.44 0Z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-14 w-14 text-[#4d61ff]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0" />
      <path d="M12 17v4" />
      <path d="M8.5 21h7" />
    </svg>
  );
}

function StoryCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12" aria-hidden="true">
      <circle cx="12" cy="6.2" r="4.1" fill="#f7b733" />
      <circle cx="17.6" cy="12" r="4.1" fill="#5c7cff" />
      <circle cx="12" cy="17.8" r="4.1" fill="#65c466" />
      <circle cx="6.4" cy="12" r="4.1" fill="#f2799b" />
      <circle cx="12" cy="12" r="2.5" fill="#ffffff" />
    </svg>
  );
}

function KeepAliveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12 text-[#5c7cff]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19.2c-4.35-3.16-6.75-5.64-6.75-8.57 0-2.15 1.67-3.88 3.76-3.88 1.37 0 2.67.67 3.49 1.77.82-1.1 2.12-1.77 3.49-1.77 2.09 0 3.76 1.73 3.76 3.88 0 2.93-2.4 5.41-6.75 8.57Z" />
    </svg>
  );
}

export default async function LandingPage() {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect('/create');
  }

  return (
    <main className="min-h-screen bg-[#f3f3f3]">
      <div className="mx-auto min-h-screen max-w-[26rem] overflow-hidden bg-white shadow-[0_0_0_1px_rgba(32,32,32,0.18)]">
        <header className="bg-[#202020]">
          <div className="flex h-[2.75rem] items-center justify-between px-4 text-[0.72rem] font-semibold tracking-[0.02em] text-white">
            <div className="flex items-center gap-5">
              <Link href="/" className="text-white/62">
                HOME
              </Link>
              <span className="text-white/62">EMBERS</span>
            </div>

            <HeaderMenu
              authMode="signed-out"
              className="text-white/52 hover:text-white"
              iconClassName="h-[0.95rem] w-[0.95rem]"
              panelClassName="right-0 top-[calc(100%+0.35rem)] min-w-[8.5rem] rounded-none border border-[#2d2d2d] bg-[#202020] p-1 shadow-[0_12px_28px_rgba(0,0,0,0.24)]"
            />
          </div>
        </header>

        <section className="px-7 pt-11 pb-14 text-center">
          <div className="flex flex-col items-center">
            <EmberSparkIcon />

            <h1 className="mt-5 text-[2.15rem] font-black leading-[1.03] tracking-[-0.045em] text-[#111111]">
              Hi, this is ember
            </h1>

            <p className="mt-3 max-w-[18rem] text-[0.97rem] leading-[1.65] text-[#8d8d8d]">
              An AI-guided companion that helps you preserve memories through shared,
              thoughtful conversations with friends and family.
            </p>

            <div className="mt-10 flex flex-col items-center">
              <MicIcon />
              <p className="mt-4 max-w-[19rem] text-[0.97rem] leading-[1.7] text-[#8d8d8d]">
                Ember records real voices of the people who gather to reflect on a
                moment-capturing what happened, how it felt, and what it meant to
                everyone.
              </p>
            </div>

            <div className="mt-12 flex flex-col items-center">
              <h2 className="text-[2rem] font-black leading-none tracking-[-0.045em] text-[#111111]">
                The Story Circle
              </h2>
              <div className="mt-3">
                <StoryCircleIcon />
              </div>
              <p className="mt-4 max-w-[18.8rem] text-[0.97rem] leading-[1.7] text-[#8d8d8d]">
                Invite others to join a group conversation about a time or place
                {' '}preserving not just the stories, but the voices and reactions
                around them.
              </p>
            </div>

            <div className="mt-12 flex flex-col items-center">
              <h2 className="text-[2rem] font-black leading-none tracking-[-0.045em] text-[#111111]">
                Keep It Alive
              </h2>
              <div className="mt-3">
                <KeepAliveIcon />
              </div>
              <p className="mt-4 max-w-[18.6rem] text-[0.97rem] leading-[1.7] text-[#8d8d8d]">
                Ember connects every story into a living archive. Evolving as new
                memories, voices, and perspectives are added over time.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
