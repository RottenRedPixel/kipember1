import { redirect } from 'next/navigation';
import AuthTopNav from '@/components/AuthTopNav';
import AuthForm from '@/components/AuthForm';
import { getCurrentAuth } from '@/lib/auth-server';

export default async function SignupPage() {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect('/feed');
  }

  return (
    <main className="ember-page">
      <AuthTopNav signedIn={false} />
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center px-4 py-10">
        <AuthForm mode="signup" />
      </div>
    </main>
  );
}
