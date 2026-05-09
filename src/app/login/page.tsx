import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { getCurrentAuth } from '@/lib/auth-server';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; next?: string; info?: string }>;
}) {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect('/home');
  }

  const { phone, next, info } = await searchParams;

  return (
    <Suspense>
      <AuthForm mode="login" defaultPhone={phone} next={next} info={info} />
    </Suspense>
  );
}
