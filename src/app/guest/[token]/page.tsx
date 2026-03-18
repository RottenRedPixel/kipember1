import AuthTopNav from '@/components/AuthTopNav';
import GuestMemoryExperience from '@/components/GuestMemoryExperience';
import { getCurrentAuth } from '@/lib/auth-server';

export default async function GuestMemoryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const auth = await getCurrentAuth();

  return (
    <main className="ember-page">
      <AuthTopNav
        signedIn={Boolean(auth)}
        userName={auth?.user.name || null}
        userEmail={auth?.user.email || null}
      />
      <GuestMemoryExperience token={token} />
    </main>
  );
}
