import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import TendActionScreen from '@/components/kipember/TendActionScreen';

export default async function TendActionPage({
  params,
}: {
  params: Promise<{ action: string }>;
}) {
  const auth = await getCurrentAuth();
  if (!auth) {
    redirect('/signin');
  }

  const { action } = await params;
  return <TendActionScreen action={action} />;
}
