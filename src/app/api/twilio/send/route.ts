import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess, ensureOwnedContributorAccess } from '@/lib/ember';
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
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to send SMS invite' },
          { status: 502 }
        );
      }

      return NextResponse.json({ success: true, sent: 1 });
    }

    if (imageId) {
      const image = await ensureEmberOwnerAccess(auth.user.id, imageId);
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

      if (sent === 0 && failed > 0) {
        return NextResponse.json(
          { error: 'Failed to send SMS invites', sent, failed },
          { status: 502 }
        );
      }

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

async function sendInvite(contributorId: string): Promise<{ success: boolean; error?: string }> {
  const result = await sendContributorSmsInvite(contributorId);
  return { success: result.success, error: result.error };
}
