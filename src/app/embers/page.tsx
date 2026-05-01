import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import { getAccessibleEmbersForUser } from '@/lib/ember';
import MyEmbersScreen from '@/components/kipember/MyEmbersScreen';
import { getAvatarUrl } from '@/lib/avatar';
import { getUserDisplayName } from '@/lib/user-name';

export default async function MyEmbersPage() {
  const auth = await getCurrentAuth();
  if (!auth) redirect('/signin');

  const [initialEmbers, avatarUrl] = await Promise.all([
    getAccessibleEmbersForUser(auth.user.id),
    getAvatarUrl(auth.user.id),
  ]);

  const userInitials = (getUserDisplayName(auth.user) || auth.user.email || 'ST')
    .split(/\s+/)
    .filter(Boolean)
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Suspense>
      <MyEmbersScreen
        initialEmbers={initialEmbers}
        avatarUrl={avatarUrl}
        userInitials={userInitials}
      />
    </Suspense>
  );
}
