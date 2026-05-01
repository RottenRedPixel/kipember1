import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import HomeScreen from '@/components/kipember/HomeScreen';
import { getAccessibleEmbersForUser } from '@/lib/ember';
import { getAvatarUrl } from '@/lib/avatar';

export default async function EmberViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await getCurrentAuth();
  if (!auth) {
    redirect('/signin');
  }

  const { id } = await params;
  const [initialEmbers, initialAvatarUrl] = await Promise.all([
    getAccessibleEmbersForUser(auth.user.id),
    getAvatarUrl(auth.user.id),
  ]);

  return (
    <Suspense>
      <HomeScreen
        initialProfile={auth.user}
        initialEmbers={initialEmbers}
        initialEmberId={id}
        initialAvatarUrl={initialAvatarUrl}
      />
    </Suspense>
  );
}
