import { Suspense } from 'react';
import GuestEmberScreen from '@/components/kipember/GuestEmberScreen';

export default async function ContributorMemoryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <Suspense>
      <GuestEmberScreen
        token={token}
        dataApiPath="/api/contributor"
        chatApiPath="/api/contributor"
        basePath="/contributor"
      />
    </Suspense>
  );
}
