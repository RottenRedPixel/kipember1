// /contribute/[token] resolves the contributor token and sends the user
// to the right experience:
//   - Logged-in users → /ember/[id]?ember=contributor  (full ContributorFlow)
//   - Unauthenticated users → /guest/[token]?m=hello   (GuestFlow + hello modal)

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
      select: { imageId: true },
    }).catch(() => null);

    if (ec?.imageId) {
      redirect(`/ember/${ec.imageId}?ember=contributor`);
    }
  }

  // Unauthenticated (or token not found) → guest experience
  redirect(`/guest/${token}?m=hello`);
}
