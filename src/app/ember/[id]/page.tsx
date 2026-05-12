import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import EmberViewClient from './EmberViewClient';

export default async function EmberViewPage() {
  const auth = await getCurrentAuth();
  if (!auth) redirect('/signin');
  return <EmberViewClient />;
}
