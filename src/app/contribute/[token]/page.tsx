import { Suspense } from 'react';
import ContributorNPWFlow from '@/components/kipember/ContributorNPWFlow';

export default async function ContributorPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <Suspense>
      <ContributorNPWFlow token={token} />
    </Suspense>
  );
}
