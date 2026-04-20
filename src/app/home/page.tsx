import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import HomeScreen from '@/components/kipember/HomeScreen';
import UserHomeScreen from '@/components/kipember/UserHomeScreen';
import { getAccessibleImagesForUser } from '@/lib/image-summaries';
import { getAvatarUrl } from '@/lib/avatar';

const HOME_STAGE_QUERY_KEYS = new Set([
  'id',
  'm',
  'ember',
  'mode',
  'step',
  'sub',
  'paused',
  'restart',
]);

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await getCurrentAuth();
  if (!auth) {
    redirect('/signin');
  }

  const resolvedSearchParams = await searchParams;
  const [initialImages, initialAvatarUrl] = await Promise.all([
    getAccessibleImagesForUser(auth.user.id),
    getAvatarUrl(auth.user.id),
  ]);
  const showStageView = Object.keys(resolvedSearchParams).some((key) =>
    HOME_STAGE_QUERY_KEYS.has(key)
  );

  return (
    <Suspense>
      {showStageView ? (
        <HomeScreen initialProfile={auth.user} initialImages={initialImages} />
      ) : (
        <UserHomeScreen initialProfile={auth.user} initialImages={initialImages} initialAvatarUrl={initialAvatarUrl} />
      )}
    </Suspense>
  );
}
