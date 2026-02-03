import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendSMS } from '@/lib/twilio';
import { requireAccess } from '@/lib/access-server';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const access = await requireAccess();
    if (access) return access;

    const { imageId, contributorId } = await request.json();

    if (contributorId) {
      // Send to single contributor
      const result = await sendInvite(contributorId);
      return NextResponse.json({ success: result.success, sent: result.success ? 1 : 0 });
    }

    if (imageId) {
      // Send to all contributors for an image who haven't been invited yet
      const contributors = await prisma.contributor.findMany({
        where: {
          imageId,
          inviteSent: false,
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
  const contributor = await prisma.contributor.findUnique({
    where: { id: contributorId },
    include: { image: true },
  });

  if (!contributor) {
    throw new Error('Contributor not found');
  }

  // Build the invite link
  const inviteUrl = `${BASE_URL}/contribute/${contributor.token}`;

  const greeting = contributor.name ? `Hi ${contributor.name}!` : 'Hi!';
  const intro = `${greeting} You're invited to share your memories about a special photo.`;
  const linkMessage = `Tap here to start: ${inviteUrl}`;
  const combinedMessage = `${intro} ${linkMessage}`;

  // Format phone number
  const phone = contributor.phoneNumber.startsWith('+')
    ? contributor.phoneNumber
    : contributor.phoneNumber.length === 10
      ? `+1${contributor.phoneNumber}`
      : `+${contributor.phoneNumber}`;

  try {
    if (combinedMessage.length <= 160) {
      await sendSMS(phone, combinedMessage);
    } else {
      await sendSMS(phone, intro);
      await sendSMS(phone, linkMessage);
    }

    // Mark as sent
    await prisma.contributor.update({
      where: { id: contributorId },
      data: { inviteSent: true },
    });

    return { success: true };
  } catch (error) {
    console.error(`Failed to send SMS to ${phone}:`, error);
    return { success: false };
  }
}
