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
    <header className="ember-topbar sticky top-0 z-40 backdrop-blur-md">
      <div className="mx-auto hidden max-w-6xl px-6 py-2.5 sm:block">
        {signedIn ? (
          <div className="items-center justify-between px-1 py-1 sm:flex">
            <div className="flex items-center gap-4">
              <div className="text-white">
                <EmberBrand href="/create" subtitle="workspace" compact />
              </div>
              <nav className="hidden items-center gap-2 text-sm font-medium text-white/62 sm:flex">
                <Link
                  href="/feed"
                  className="rounded-full border border-transparent px-4 py-2 transition-colors hover:border-white/8 hover:bg-white/6 hover:text-white"
                >
                  Embers
                </Link>
                <Link
                  href="/create"
                  className="rounded-full border border-transparent px-4 py-2 transition-colors hover:border-white/8 hover:bg-white/6 hover:text-white"
                >
                  Create
                </Link>
                <Link
                  href="/profile"
                  className="rounded-full border border-transparent px-4 py-2 transition-colors hover:border-white/8 hover:bg-white/6 hover:text-white"
                >
                  Profile
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden px-2 py-1 text-right sm:block">
                <div className="text-sm font-medium text-white">
                  {userName || userEmail}
                </div>
                <div className="text-xs text-white/58">{userEmail}</div>
              </div>
              <LogoutButton />
            </div>
          </div>
        ) : (
          <div className="items-center justify-between px-1 py-1 sm:flex">
            <div className="text-white">
              <EmberBrand subtitle="living memory system" />
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login" className="ember-button-secondary px-5">
                Log in
              </Link>
              <Link href="/signup" className="ember-button-primary px-5">
                Create account
              </Link>
            </div>
          </div>
        )}
      </div>

      <EmberMobileTopBar
        homeHref={signedIn ? '/create' : '/'}
        embersHref="/feed"
        addHref={signedIn ? '/create?openUploader=1' : '/?openGuestUploader=1'}
        accountHref="/access"
        variant={signedIn ? 'auto' : 'text'}
      />
    </header>
  );
}
