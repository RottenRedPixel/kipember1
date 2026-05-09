// /inbound/[token] resolves the contributor token and sends the user
// to the right experience:
//   - Logged-in users → /ember/[id]?ember=contributor  (ContributorPWFlow)
//   - Unauthenticated users → /contribute/[token]       (ContributorNPWFlow)

import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ContributeRedirect({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const auth = await getCurrentAuth();

  if (auth) {
    // Look up the ember ID for this token so we can send them to the full
    // contributor experience instead of the guest shell.
    const ec = await prisma.emberContributor.findUnique({
      where: { token },
      select: { emberId: true },
    }).catch(() => null);

    if (ec?.emberId) {
      redirect(`/ember/${ec.emberId}?ember=contributor`);
    }
  }

  // Unauthenticated (or token not found) → contributor experience
  redirect(`/contribute/${token}`);
}
