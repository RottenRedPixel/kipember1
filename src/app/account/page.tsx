import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import { isAdmin } from '@/lib/admin-access';
import { getAvatarUrl } from '@/lib/avatar';
import { prisma } from '@/lib/db';
import { getUserDisplayName } from '@/lib/user-name';
import AccountScreen from '@/components/kipember/AccountScreen';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ emberId?: string }>;
}) {
  const auth = await getCurrentAuth();
  if (!auth) redirect('/signin');

  // Legacy deep-link: /account?emberId=X → /ember/X?m=account
  const { emberId } = await searchParams;
  if (emberId) redirect(`/ember/${emberId}?m=account`);

  const [avatarUrl, user] = await Promise.all([
    getAvatarUrl(auth.user.id),
    prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { createdAt: true, voicePreferenceId: true },
    }),
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
      <AccountScreen
        firstName={auth.user.firstName}
        lastName={auth.user.lastName}
        email={auth.user.email}
        phoneNumber={auth.user.phoneNumber ?? null}
        avatarUrl={avatarUrl}
        userInitials={userInitials}
        joinedAt={user?.createdAt ?? null}
        voicePreferenceId={user?.voicePreferenceId ?? null}
        canAccessAdmin={isAdmin(auth.user)}
      />
    </Suspense>
  );
}
