import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentAuth } from '@/lib/auth-server';
import SetPasswordForm from './SetPasswordForm';

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const auth = await getCurrentAuth();
  const { next } = await searchParams;

  if (!auth) {
    redirect('/login?next=/set-password');
  }

  if (auth.user.passwordHash) {
    redirect('/home');
  }

  return (
    <Suspense>
      <SetPasswordForm
        firstName={auth.user.firstName ?? ''}
        lastName={auth.user.lastName ?? ''}
        phoneNumber={auth.user.phoneNumber ?? ''}
        next={next}
      />
    </Suspense>
  );
}
