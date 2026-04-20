import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import { getAccessibleImagesForUser } from '@/lib/image-summaries';
import MyEmbersScreen from '@/components/kipember/MyEmbersScreen';
import { getAvatarUrl } from '@/lib/avatar';

export default async function MyEmbersPage() {
  const auth = await getCurrentAuth();
  if (!auth) redirect('/signin');

  const [initialImages, avatarUrl] = await Promise.all([
    getAccessibleImagesForUser(auth.user.id),
    getAvatarUrl(auth.user.id),
  ]);

  const userInitials = (auth.user.name || auth.user.email || 'ST')
    .split(/\s+/)
    .filter(Boolean)
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Suspense>
      <MyEmbersScreen
        initialImages={initialImages}
        avatarUrl={avatarUrl}
        userInitials={userInitials}
      />
    </Suspense>
  );
}
