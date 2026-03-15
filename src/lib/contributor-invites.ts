import { prisma } from '@/lib/db';
import { getAppBaseUrl } from '@/lib/app-url';
import { sendSMS } from '@/lib/twilio';

const BASE_URL = getAppBaseUrl();

export function buildContributorInviteUrl(token: string): string {
  return `${BASE_URL}/contribute/${token}`;
}

function formatPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }

  if (phoneNumber.length === 10) {
    return `+1${phoneNumber}`;
  }

  return `+${phoneNumber}`;
}

export async function sendContributorSmsInvite(
  contributorId: string
): Promise<{ success: boolean; inviteUrl: string }> {
  const contributor = await prisma.contributor.findUnique({
    where: { id: contributorId },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      token: true,
    },
  });

  if (!contributor) {
    throw new Error('Contributor not found');
  }

  if (!contributor.phoneNumber) {
    throw new Error('Contributor does not have a phone number for SMS invites');
  }

  const inviteUrl = buildContributorInviteUrl(contributor.token);
  const greeting = contributor.name ? `Hi ${contributor.name}!` : 'Hi!';
  const intro = `${greeting} You're invited to share your memories about a special photo with Ember.`;
  const linkMessage = `Tap here to text with Ember or speak with Ember: ${inviteUrl}`;
  const combinedMessage = `${intro} ${linkMessage}`;
  const phone = formatPhoneNumber(contributor.phoneNumber);

  try {
    if (combinedMessage.length <= 160) {
      await sendSMS(phone, combinedMessage);
    } else {
      await sendSMS(phone, intro);
      await sendSMS(phone, linkMessage);
    }

    await prisma.contributor.update({
      where: { id: contributorId },
      data: { inviteSent: true },
    });

    return { success: true, inviteUrl };
  } catch (error) {
    console.error(`Failed to send SMS to ${phone}:`, error);
    return { success: false, inviteUrl };
  }
}
