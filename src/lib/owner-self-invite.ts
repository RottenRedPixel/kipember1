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
 *
 * Takes the EmberContributor.id (per-ember row), not the pool Contributor.id.
 */
export async function sendOwnerSelfSms(
  emberContributorId: string
): Promise<{ success: boolean; error?: string }> {
  const emberContributor = await prisma.emberContributor.findUnique({
    where: { id: emberContributorId },
    select: {
      token: true,
      user: { select: { phoneNumber: true } },
    },
  });

  if (!emberContributor?.user?.phoneNumber) {
    return { success: false, error: 'No phone number on file' };
  }

  const link = buildContributorInviteUrl(emberContributor.token);
  const message = `Kipember: continue adding to your memory here: ${link}`;

  try {
    await sendSMS(formatPhoneForSms(emberContributor.user.phoneNumber), message);
    await prisma.emberContributor.update({
      where: { id: emberContributorId },
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
