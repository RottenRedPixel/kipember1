import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import { getAvatarUrl } from '@/lib/avatar';
import { prisma } from '@/lib/db';
import AccountScreen from '@/components/kipember/AccountScreen';

export default async function AccountPage() {
  const auth = await getCurrentAuth();
  if (!auth) redirect('/signin');

  const [avatarUrl, user] = await Promise.all([
    getAvatarUrl(auth.user.id),
    prisma.user.findUnique({ where: { id: auth.user.id }, select: { createdAt: true } }),
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
      <AccountScreen
        name={auth.user.name}
        email={auth.user.email}
        phoneNumber={auth.user.phoneNumber ?? null}
        avatarUrl={avatarUrl}
        userInitials={userInitials}
        joinedAt={user?.createdAt ?? null}
      />
    </Suspense>
  );
}
