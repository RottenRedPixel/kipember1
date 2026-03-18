import Link from 'next/link';
import EmberBrand from '@/components/EmberBrand';
import EmberMobileTopBar from '@/components/EmberMobileTopBar';
import LogoutButton from '@/components/LogoutButton';
import { requirePageUser } from '@/lib/auth-server';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageUser();

  return (
    <div className="ember-page">
      <header className="relative z-10 px-4 pt-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="ember-panel hidden items-center justify-between rounded-full px-4 py-3 sm:flex">
            <div className="flex items-center gap-4">
              <EmberBrand href="/feed" subtitle="owner and contributor workspace" compact />
              <nav className="hidden items-center gap-2 rounded-full bg-[rgba(247,247,247,0.9)] p-1 text-sm text-[var(--ember-muted)] sm:flex">
                <Link
                  href="/feed"
                  className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-[var(--ember-text)]"
                >
                  Embers
                </Link>
                <Link
                  href="/feed#add-ember"
                  className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-[var(--ember-text)]"
                >
                  Add Ember
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
                  {user.name || user.email}
                </div>
                <div className="text-xs text-[var(--ember-muted)]">{user.email}</div>
              </div>
              <LogoutButton />
            </div>
          </div>

          <EmberMobileTopBar
            homeHref="/feed"
            embersHref="/feed"
            addHref="/feed?openUploader=1"
            accountHref="/access"
            openUploaderOnFeed
          />
        </div>
      </header>

      <main className="relative z-10">{children}</main>
    </div>
  );
}
