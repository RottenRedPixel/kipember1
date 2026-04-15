import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { getCurrentAuth } from '@/lib/auth-server';

export default async function SignupPage() {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect('/home');
  }

  return <AuthForm mode="signup" />;
}
