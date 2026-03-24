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
      <header className="relative z-10 px-4 pt-2 sm:px-6 sm:pt-3">
        <div className="mx-auto max-w-6xl">
          <div className="hidden items-center justify-between px-1 py-1 sm:flex">
            <div className="flex items-center gap-4">
              <EmberBrand href="/create" subtitle="owner and contributor workspace" compact />
              <nav className="hidden items-center gap-2 text-sm font-medium text-[var(--ember-muted)] sm:flex">
                <Link
                  href="/feed"
                  className="rounded-[0.85rem] px-4 py-2 transition-colors hover:text-[var(--ember-text)]"
                >
                  Embers
                </Link>
                <Link
                  href="/create"
                  className="rounded-[0.85rem] px-4 py-2 transition-colors hover:text-[var(--ember-text)]"
                >
                  Add Ember
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
                  {user.name || user.email}
                </div>
                <div className="text-xs text-[var(--ember-muted)]">{user.email}</div>
              </div>
              <LogoutButton />
            </div>
          </div>

          <EmberMobileTopBar
            homeHref="/create"
            embersHref="/feed"
            addHref="/create?openUploader=1"
            accountHref="/access"
          />
        </div>
      </header>

      <main className="relative z-10">{children}</main>
    </div>
  );
}
