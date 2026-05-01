import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import UserActionScreen from '@/components/kipember/UserActionScreen';
import { getFriendNetworkForUser } from '@/lib/friend-network';
import { getAccessibleEmbersForUser } from '@/lib/image-summaries';

export default async function UserActionPage({
  params,
}: {
  params: Promise<{ action: string }>;
}) {
  const auth = await getCurrentAuth();
  if (!auth) {
    redirect('/signin');
  }

  const { action } = await params;
  const isEmberList = action === 'my-embers' || action === 'shared-embers';

  if (isEmberList) {
    const initialImages = await getAccessibleEmbersForUser(auth.user.id);
    return <UserActionScreen action={action} initialImages={initialImages} />;
  }

  const initialFriends = await getFriendNetworkForUser(auth.user.id);
  return (
    <UserActionScreen
      action={action}
      initialProfile={auth.user}
      initialFriends={initialFriends}
    />
  );
}
