import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import { isAdmin } from '@/lib/admin-access';
import { getAvatarUrl } from '@/lib/avatar';
import { prisma } from '@/lib/db';
import { getPreviewMediaUrl } from '@/lib/media';
import AccountScreen from '@/components/kipember/AccountScreen';
import { getUserDisplayName } from '@/lib/user-name';

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ imageId?: string }> }) {
  const auth = await getCurrentAuth();
  if (!auth) redirect('/signin');

  const { imageId } = await searchParams;

  const [avatarUrl, user, image] = await Promise.all([
    getAvatarUrl(auth.user.id),
    prisma.user.findUnique({ where: { id: auth.user.id }, select: { createdAt: true } }),
    imageId ? prisma.image.findUnique({ where: { id: imageId }, select: { mediaType: true, filename: true, posterFilename: true } }) : null,
  ]);

  const coverPhotoUrl = image
    ? getPreviewMediaUrl({ mediaType: image.mediaType, filename: image.filename, posterFilename: image.posterFilename ?? null })
    : null;

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
        coverPhotoUrl={coverPhotoUrl}
        canAccessAdmin={isAdmin(auth.user)}
      />
    </Suspense>
  );
}
