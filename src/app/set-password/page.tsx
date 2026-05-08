import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentAuth } from '@/lib/auth-server';
import SetPasswordForm from './SetPasswordForm';

export default async function SetPasswordPage() {
  const auth = await getCurrentAuth();

  if (!auth) {
    redirect('/signin');
  }

  if (auth.user.passwordHash) {
    redirect('/home');
  }

  return (
    <Suspense>
      <SetPasswordForm
        firstName={auth.user.firstName ?? ''}
        lastName={auth.user.lastName ?? ''}
      />
    </Suspense>
  );
}
