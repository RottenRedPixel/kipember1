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
    <header className="relative z-10 px-4 pt-2 sm:px-6 sm:pt-3">
      <div className="mx-auto max-w-6xl">
        {signedIn ? (
          <div className="hidden items-center justify-between px-1 py-1 sm:flex">
            <div className="flex items-center gap-4">
              <EmberBrand href="/create" subtitle="account access" compact />
              <nav className="hidden items-center gap-2 text-sm font-medium text-[var(--ember-muted)] sm:flex">
                <Link
                  href="/feed"
                  className="rounded-[0.85rem] px-4 py-2 transition-colors hover:text-[var(--ember-text)]"
                >
                  Embers
                </Link>
                <Link
                  href="/profile"
                  className="rounded-[0.85rem] px-4 py-2 transition-colors hover:text-[var(--ember-text)]"
                >
                  Profile
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden px-2 py-1 text-right sm:block">
                <div className="text-sm font-medium text-[var(--ember-text)]">
                  {userName || userEmail}
                </div>
                <div className="text-xs text-[var(--ember-muted)]">{userEmail}</div>
              </div>
              <LogoutButton />
            </div>
          </div>
        ) : (
          <div className="hidden items-center justify-between px-1 py-1 sm:flex">
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
          homeHref={signedIn ? '/create' : '/'}
          embersHref="/feed"
          addHref={signedIn ? '/create?openUploader=1' : '/?openGuestUploader=1'}
          accountHref="/access"
        />
      </div>
    </header>
  );
}
