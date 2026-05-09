import { Suspense } from 'react';
import ContributorScreen from '@/components/kipember/ContributorScreen';

export default async function ContributorPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <Suspense>
      <ContributorScreen token={token} />
    </Suspense>
  );
}
