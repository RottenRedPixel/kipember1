import { redirect } from 'next/navigation';
import AuthTopNav from '@/components/AuthTopNav';
import AuthForm from '@/components/AuthForm';
import { getCurrentAuth } from '@/lib/auth-server';

export default async function LoginPage() {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect('/feed');
  }

  return (
    <main className="ember-page">
      <AuthTopNav signedIn={false} />
      <div className="flex min-h-[calc(100vh-6rem)] items-start justify-center px-3 pt-3 pb-6 sm:px-4 sm:pt-4 sm:pb-8">
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
