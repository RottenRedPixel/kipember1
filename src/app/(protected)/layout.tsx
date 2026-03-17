import Link from 'next/link';
import EmberBrand from '@/components/EmberBrand';
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
                  Feed
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

          <details className="sm:hidden">
            <summary className="ember-summary ember-panel flex w-full items-center justify-between rounded-[1.6rem] px-4 py-4">
              <EmberBrand subtitle="personal archive" compact staticBrand />
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ember-charcoal)] text-white">
                <span className="sr-only">Open navigation</span>
                <span className="flex flex-col gap-1.5">
                  <span className="h-0.5 w-5 rounded-full bg-white" />
                  <span className="h-0.5 w-5 rounded-full bg-white" />
                  <span className="h-0.5 w-5 rounded-full bg-white" />
                </span>
              </span>
            </summary>

            <div className="ember-panel-strong mt-3 rounded-[1.75rem] p-4">
              <div className="rounded-[1.35rem] bg-white/90 px-4 py-3">
                <div className="text-sm font-medium text-[var(--ember-text)]">
                  {user.name || user.email}
                </div>
                <div className="mt-1 text-xs text-[var(--ember-muted)]">{user.email}</div>
              </div>

              <nav className="mt-4 grid gap-2">
                <Link
                  href="/feed"
                  className="rounded-[1.2rem] border border-[var(--ember-line)] bg-white px-4 py-3 text-sm font-medium text-[var(--ember-text)]"
                >
                  Feed
                </Link>
                <Link
                  href="/profile"
                  className="rounded-[1.2rem] border border-[var(--ember-line)] bg-white px-4 py-3 text-sm font-medium text-[var(--ember-text)]"
                >
                  Profile
                </Link>
              </nav>

              <div className="mt-4">
                <LogoutButton />
              </div>
            </div>
          </details>
        </div>
      </header>

      <main className="relative z-10">{children}</main>
    </div>
  );
}
