import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { getCurrentAuth } from '@/lib/auth-server';

export default async function LoginPage() {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect('/feed');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fde68a_0%,rgba(253,230,138,0.12)_24%,transparent_55%),linear-gradient(180deg,#fffef9_0%,#eef4ff_100%)] px-4 py-10">
      <AuthForm mode="login" />
    </main>
  );
}
