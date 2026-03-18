import Link from 'next/link';
import EmberBrand from '@/components/EmberBrand';
import EmberMobileTopBar from '@/components/EmberMobileTopBar';
import LogoutButton from '@/components/LogoutButton';

type AuthTopNavProps = {
  signedIn: boolean;
  userName?: string | null;
  userEmail?: string | null;
};

export default function AuthTopNav({
  signedIn,
  userName = null,
  userEmail = null,
}: AuthTopNavProps) {
  return (
    <header className="relative z-10 px-4 pt-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        {signedIn ? (
          <div className="ember-panel hidden items-center justify-between rounded-full px-4 py-3 sm:flex">
            <div className="flex items-center gap-4">
              <EmberBrand href="/feed" subtitle="account access" compact />
              <nav className="hidden items-center gap-2 rounded-full bg-[rgba(247,247,247,0.9)] p-1 text-sm text-[var(--ember-muted)] sm:flex">
                <Link
                  href="/feed"
                  className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-[var(--ember-text)]"
                >
                  Embers
                </Link>
                <Link
                  href="/profile"
                  className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-[var(--ember-text)]"
                >
                  Profile
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-full bg-white/80 px-4 py-2 text-right sm:block">
                <div className="text-sm font-medium text-[var(--ember-text)]">
                  {userName || userEmail}
                </div>
                <div className="text-xs text-[var(--ember-muted)]">{userEmail}</div>
              </div>
              <LogoutButton />
            </div>
          </div>
        ) : (
          <div className="ember-panel hidden items-center justify-between rounded-full px-5 py-4 sm:flex">
            <EmberBrand subtitle="account access" />
            <div className="flex items-center gap-3">
              <Link href="/login" className="ember-button-secondary px-5">
                Login
              </Link>
              <Link href="/signup" className="ember-button-primary px-5">
                Create account
              </Link>
            </div>
          </div>
        )}

        <EmberMobileTopBar
          homeHref={signedIn ? '/feed' : '/'}
          embersHref="/feed"
          addHref={signedIn ? '/feed?openUploader=1' : '/signup'}
          accountHref="/access"
          openUploaderOnFeed={signedIn}
        />
      </div>
    </header>
  );
}
