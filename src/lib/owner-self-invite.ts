import { prisma } from '@/lib/db';
import { buildContributorInviteUrl } from '@/lib/contributor-invites';
import { sendSMS } from '@/lib/twilio';

function formatPhoneForSms(phoneNumber: string): string {
  if (phoneNumber.startsWith('+')) return phoneNumber;
  if (phoneNumber.length === 10) return `+1${phoneNumber}`;
  return `+${phoneNumber}`;
}

/**
 * Text the owner a link back into their own contributor view so they can
 * pick up the interview/recording on their phone. Kept short and ASCII-only
 * so voip.ms accepts it in a single GSM-7 segment.
 */
export async function sendOwnerSelfSms(
  contributorId: string
): Promise<{ success: boolean; error?: string }> {
  const contributor = await prisma.contributor.findUnique({
    where: { id: contributorId },
    select: { phoneNumber: true, token: true },
  });

  if (!contributor?.phoneNumber) {
    return { success: false, error: 'No phone number on file' };
  }

  const link = buildContributorInviteUrl(contributor.token);
  const message = `Kipember: continue adding to your memory here: ${link}`;

  try {
    await sendSMS(formatPhoneForSms(contributor.phoneNumber), message);
    await prisma.contributor.update({
      where: { id: contributorId },
      data: { inviteSent: true },
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}
