import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess, ensureOwnedContributorAccess } from '@/lib/ember-access';
import { sendContributorSmsInvite } from '@/lib/contributor-invites';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageId, contributorId } = await request.json();

    if (contributorId) {
      // Send to single contributor
      const contributor = await ensureOwnedContributorAccess(auth.user.id, contributorId);
      if (!contributor) {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      }

      const result = await sendInvite(contributorId);
      return NextResponse.json({ success: result.success, sent: result.success ? 1 : 0 });
    }

    if (imageId) {
      const image = await ensureImageOwnerAccess(auth.user.id, imageId);
      if (!image) {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      }

      // Send to all contributors for an image who haven't been invited yet
      const contributors = await prisma.contributor.findMany({
        where: {
          imageId,
          inviteSent: false,
          phoneNumber: {
            not: null,
          },
        },
      });

      const results = await Promise.allSettled(
        contributors.map((c) => sendInvite(c.id))
      );

      const sent = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

      return NextResponse.json({ success: true, sent, failed });
    }

    return NextResponse.json(
      { error: 'imageId or contributorId is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error sending SMS:', error);
    return NextResponse.json(
      { error: 'Failed to send SMS invites' },
      { status: 500 }
    );
  }
}

async function sendInvite(contributorId: string): Promise<{ success: boolean }> {
  const result = await sendContributorSmsInvite(contributorId);
  return { success: result.success };
}
