import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { getCurrentAuth } from '@/lib/auth-server';

export default async function SignupPage() {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect('/home');
  }

  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
