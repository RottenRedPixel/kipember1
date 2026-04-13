import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import AuthTopNav from '@/components/AuthTopNav';
import { getCurrentAuth } from '@/lib/auth-server';

export default async function LoginPage() {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect('/feed');
  }

  return (
    <main className="ember-page">
      <AuthTopNav signedIn={false} />
      <div className="ember-auth-shell min-h-[calc(100vh-4.5rem)] items-start">
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
