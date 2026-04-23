import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import HomeScreen from '@/components/kipember/HomeScreen';
import { getAccessibleImagesForUser } from '@/lib/image-summaries';

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
  const initialImages = await getAccessibleImagesForUser(auth.user.id);

  return (
    <Suspense>
      <HomeScreen
        initialProfile={auth.user}
        initialImages={initialImages}
        initialImageId={id}
      />
    </Suspense>
  );
}
