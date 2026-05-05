import Link from 'next/link';
import { getCurrentAuth } from '@/lib/auth-server';
import AppHeader from '@/components/kipember/AppHeader';

export default async function LandingPage() {
  const auth = await getCurrentAuth();
  const isLoggedIn = Boolean(auth);

  return (
    <div
      className="flex min-h-[100dvh] w-full flex-col items-center justify-start px-4"
      style={{ background: 'var(--bg-screen)', paddingTop: 56 }}
    >
      <AppHeader />
      <div className="flex w-full max-w-xl flex-col gap-8 pt-6 pb-16 fade-in">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            This is ember
          </h1>
          <p className="text-base leading-relaxed text-white/60">
            An AI-guided companion that helps you preserve memories through shared, thoughtful conversations with friends and family.
          </p>
          <h2 className="text-base font-medium text-white">Voices Matter</h2>
          <p className="text-base leading-relaxed text-white/60">
            Ember records real voices of the people who gather to reflect on a moment-capturing what happened, how it felt, and what it meant to everyone.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-medium text-white">Keep It Alive</h2>
          <p className="text-base leading-relaxed text-white/60">
            Ember connects every story into a living archive. Evolving as new memories, voices, and perspectives are added over time.
          </p>
        </div>

        {isLoggedIn ? (
          <Link
            href="/home"
            className="flex w-full items-center justify-center rounded-full text-sm font-medium text-white transition-opacity hover:opacity-80"
            style={{ background: '#f97316', minHeight: 44 }}
          >
            Get Started
          </Link>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/signup"
              className="flex w-full items-center justify-center rounded-full text-sm font-medium text-white transition-opacity hover:opacity-80 btn-primary"
              style={{ background: '#f97316', minHeight: 44 }}
            >
              Sign Up
            </Link>
            <p className="text-center text-white/60 text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-white font-medium hover:opacity-70 transition-opacity">
                Login
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
