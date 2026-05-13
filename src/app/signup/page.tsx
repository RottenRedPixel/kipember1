import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { getCurrentAuth } from '@/lib/auth-server';

export default async function SignupPage() {
  const auth = await getCurrentAuth();

  // Only bounce away if the user already has a password set. An authenticated
  // session with no password is mid-signup and must stay on this page —
  // otherwise /home would redirect them right back here, causing a loop.
  if (auth?.user.passwordHash) {
    redirect('/home');
  }

  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
