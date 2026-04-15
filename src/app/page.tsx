import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';

export default async function LandingPage() {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect('/home');
  }

  return (
    <div
      className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg-screen)' }}
    >
      <div className="flex w-full max-w-sm flex-col gap-8 py-16">
        <div className="flex flex-col gap-3">
          <h1 className="flex items-start gap-1.5 text-2xl font-bold tracking-tight text-white">
            ask ember
            <svg width={22} height={22} viewBox="0 0 72 72" fill="white" className="mt-0.5 flex-shrink-0">
              <circle cx="36" cy="36" r="7.2" fill="#f97316" />
              <rect x="32.4" y="3.18" width="7.2" height="21.6" rx="3.6" ry="3.6" />
              <rect x="32.4" y="47.22" width="7.2" height="21.6" rx="3.6" ry="3.6" />
              <rect x="10.38" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-22.02 49.98) rotate(-90)" />
              <rect x="54.42" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(22.02 94.02) rotate(-90)" />
              <rect x="47.97" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(29.55 -30.48) rotate(45)" />
              <rect x="16.83" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(42.45 .66) rotate(45)" />
              <rect x="16.83" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-8.46 20.43) rotate(-45)" />
              <rect x="47.97" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-21.36 51.57) rotate(-45)" />
            </svg>
          </h1>
          <p className="text-base leading-relaxed text-white/60">
            An AI-guided companion that helps you preserve memories through shared, thoughtful conversations with friends and family.
          </p>
          <h2 className="text-base font-medium text-white">Voices Matter</h2>
          <p className="text-base leading-relaxed text-white/60">
            Ember records real voices of the people who gather to reflect on a moment-capturing what happened, how it felt, and what it meant to everyone.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-base font-medium text-white">The Story Circle</h2>
            <p className="text-base leading-relaxed text-white/60">
              Invite others to join a group conversation about a time or place-preserving not just the stories, but the voices and reactions around them.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-base font-medium text-white">Keep It Alive</h2>
            <p className="text-base leading-relaxed text-white/60">
              Ember connects every story into a living archive. Evolving as new memories, voices, and perspectives are added over time.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <Link
            href="/signup"
            className="flex w-full items-center justify-center rounded-full text-sm font-medium text-white transition-opacity hover:opacity-80 btn-primary"
            style={{ background: '#f97316', minHeight: 44 }}
          >
            Sign Up
          </Link>
          <Link
            href="/signin"
            className="flex w-full items-center justify-center rounded-full text-sm font-medium text-white btn-secondary"
            style={{ border: '1.5px solid rgba(255,255,255,0.35)', minHeight: 44 }}
          >
            Sign In
          </Link>
          <Link
            href="/dev"
            className="px-6 py-3 text-white/30 transition-colors hover:text-white/40"
          >
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
