import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';

export default async function DevPage() {
  const auth = await getCurrentAuth();
  redirect(auth ? '/home' : '/signin');
}
