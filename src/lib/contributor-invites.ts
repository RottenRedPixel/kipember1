import { prisma } from '@/lib/db';
import { getAppBaseUrl } from '@/lib/app-url';
import { sendSMS } from '@/lib/twilio';
import { getUserDisplayName } from '@/lib/user-name';

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

/**
 * Send a contributor invite SMS for a specific EmberContributor (per-ember
 * attachment). The id is the EmberContributor.id, not the pool Contributor.id.
 */
export async function sendContributorSmsInvite(
  emberContributorId: string
): Promise<{ success: boolean; inviteUrl: string; error?: string }> {
  const emberContributor = await prisma.emberContributor.findUnique({
    where: { id: emberContributorId },
    select: {
      id: true,
      token: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          phoneNumber: true,
        },
      },
      image: {
        select: {
          owner: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!emberContributor) {
    throw new Error('Contributor not found');
  }

  if (!emberContributor.user.phoneNumber) {
    throw new Error('Contributor does not have a phone number for SMS invites');
  }

  const inviteUrl = buildContributorInviteUrl(emberContributor.token);
  const ownerName = getUserDisplayName(emberContributor.image.owner) || 'Someone';
  const intro = `${ownerName} needs your help to complete a memory shared with you.`;
  const linkMessage = `Go to ${inviteUrl} to start!`;
  const emberMessage =
    'Ember is a memory app that helps preserve moments through guided conversations.';
  const combinedMessage = `${intro} ${linkMessage} ${emberMessage}`;
  const phone = formatPhoneNumber(emberContributor.user.phoneNumber);

  try {
    if (combinedMessage.length <= 160) {
      await sendSMS(phone, combinedMessage);
    } else {
      await sendSMS(phone, intro);
      await sendSMS(phone, linkMessage);
      await sendSMS(phone, emberMessage);
    }

    await prisma.emberContributor.update({
      where: { id: emberContributorId },
      data: { inviteSent: true },
    });

    return { success: true, inviteUrl };
  } catch (error) {
    console.error(`Failed to send SMS to ${phone}:`, error);
    return {
      success: false,
      inviteUrl,
      error: error instanceof Error ? error.message : 'Failed to send SMS invite',
    };
  }
}
