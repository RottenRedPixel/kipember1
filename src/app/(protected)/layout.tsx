import EmberMobileTopBar from '@/components/EmberMobileTopBar';
import { requirePageUser } from '@/lib/auth-server';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageUser();

  return (
    <div className="ember-page">
      <div className="ember-app-shell">
        <header className="ember-topbar sticky top-0 z-40">
          <EmberMobileTopBar
            homeHref="/create"
            embersHref="/feed"
            addHref="/create?openUploader=1"
            accountHref="/access"
            menuAuthMode="signed-in"
          />
        </header>

        <main className="relative z-10 min-h-[calc(100vh-2.7rem)]">{children}</main>
      </div>
    </div>
  );
}
