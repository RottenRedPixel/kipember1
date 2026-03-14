import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { getCurrentAuth } from '@/lib/auth-server';

export default async function SignupPage() {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect('/feed');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,#bfdbfe_0%,rgba(191,219,254,0.2)_28%,transparent_56%),linear-gradient(180deg,#fffdf8_0%,#f5f7ff_100%)] px-4 py-10">
      <AuthForm mode="signup" />
    </main>
  );
}
