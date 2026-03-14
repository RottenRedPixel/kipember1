import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';
import { requirePageUser } from '@/lib/auth-server';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageUser();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f9fc_0%,#eef4ff_42%,#fff8ee_100%)] text-slate-950">
      <header className="border-b border-white/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/feed" className="text-lg font-semibold tracking-tight text-slate-950">
              Ember Archive
            </Link>
            <nav className="hidden items-center gap-3 text-sm text-slate-600 sm:flex">
              <Link href="/feed" className="transition-colors hover:text-slate-950">
                Feed
              </Link>
              <Link href="/profile" className="transition-colors hover:text-slate-950">
                Profile
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-900">
                {user.name || user.email}
              </div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
