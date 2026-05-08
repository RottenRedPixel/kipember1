import { Suspense } from 'react';
import GuestEmberScreen from '@/components/kipember/GuestEmberScreen';

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <Suspense>
      <GuestEmberScreen
        token={token}
        dataApiPath="/api/share"
        chatApiPath="/api/share"
      />
    </Suspense>
  );
}
