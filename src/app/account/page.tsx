import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';

// Account view has moved to a modal on /ember/[id]?m=account (or
// /home?m=account when no ember is selected) so the underlying view
// stays mounted behind it. Old /account?imageId=X URLs (deep links,
// older bookmarks) get bridged to the new modal URL transparently.
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ imageId?: string }>;
}) {
  const auth = await getCurrentAuth();
  if (!auth) redirect('/signin');

  const { imageId } = await searchParams;
  if (imageId) {
    redirect(`/ember/${imageId}?m=account`);
  }
  redirect('/home?m=account');
}
