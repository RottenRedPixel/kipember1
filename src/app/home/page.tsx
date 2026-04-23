import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import UserHomeScreen from '@/components/kipember/UserHomeScreen';
import { getAccessibleImagesForUser } from '@/lib/image-summaries';
import { getAvatarUrl } from '@/lib/avatar';

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

  // Legacy redirect: /home?id=X[&...] -> /ember/X[?...]
  const rawId = resolvedSearchParams.id;
  const legacyId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (typeof legacyId === 'string' && legacyId.length > 0) {
    const preserved = new URLSearchParams();
    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if (key === 'id' || value === undefined) continue;
      if (Array.isArray(value)) {
        value.forEach((v) => preserved.append(key, v));
      } else {
        preserved.set(key, value);
      }
    }
    const query = preserved.toString();
    redirect(query ? `/ember/${legacyId}?${query}` : `/ember/${legacyId}`);
  }

  const [initialImages, initialAvatarUrl] = await Promise.all([
    getAccessibleImagesForUser(auth.user.id),
    getAvatarUrl(auth.user.id),
  ]);

  return (
    <Suspense>
      <UserHomeScreen initialProfile={auth.user} initialImages={initialImages} initialAvatarUrl={initialAvatarUrl} />
    </Suspense>
  );
}
