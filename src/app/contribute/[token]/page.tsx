import { Suspense } from 'react';
import GuestEmberScreen from '@/components/kipember/GuestEmberScreen';

export default async function ContributorPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <Suspense>
      <GuestEmberScreen
        token={token}
        dataApiPath="/api/contribute"
        chatApiPath="/api/contribute"
        basePath="/contribute"
      />
    </Suspense>
  );
}
