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
          id: true,
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

  const inviteUrl = buildContributorInviteUrl(emberContributor.token!);

  const contributorFirstName = emberContributor.user.firstName || 'there';
  const ownerFirstName = emberContributor.image.owner.firstName || 'Someone';
  const message = `Hi ${contributorFirstName}, this is Ember. ${ownerFirstName} invited you to help build a memory: ${inviteUrl}`;
  const phone = formatPhoneNumber(emberContributor.user.phoneNumber);

  try {
    await sendSMS(phone, message);

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
