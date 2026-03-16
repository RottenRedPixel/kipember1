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
        <div className="ember-panel mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-3">
          <div className="flex items-center gap-4">
            <EmberBrand href="/feed" subtitle="owner and contributor workspace" compact />
            <nav className="hidden items-center gap-2 rounded-full bg-[rgba(247,247,247,0.9)] p-1 text-sm text-[var(--ember-muted)] sm:flex">
              <Link href="/feed" className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-[var(--ember-text)]">
                Feed
              </Link>
              <Link href="/profile" className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-[var(--ember-text)]">
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
      </header>

      <main className="relative z-10">{children}</main>
    </div>
  );
}
