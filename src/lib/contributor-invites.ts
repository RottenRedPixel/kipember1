import { prisma } from '@/lib/db';
import { getAppBaseUrl } from '@/lib/app-url';
import { getOrCreateShortLink } from '@/lib/short-links';
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
): Promise<{ success: boolean; inviteUrl: string; error?: string }> {
  const contributor = await prisma.contributor.findUnique({
    where: { id: contributorId },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      token: true,
      image: {
        select: {
          owner: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!contributor) {
    throw new Error('Contributor not found');
  }

  if (!contributor.phoneNumber) {
    throw new Error('Contributor does not have a phone number for SMS invites');
  }

  const inviteUrl = buildContributorInviteUrl(contributor.token);
  const shortLink = await getOrCreateShortLink(inviteUrl);
  const shortInviteUrl = shortLink.shortUrl;
  const ownerName = contributor.image.owner.name?.trim() || 'Someone';
  const intro = `${ownerName} needs your help to complete a memory shared with you.`;
  const linkMessage = `Go to ${shortInviteUrl} to start!`;
  const emberMessage =
    'Ember is a memory app that helps preserve moments through guided conversations.';
  const combinedMessage = `${intro} ${linkMessage} ${emberMessage}`;
  const phone = formatPhoneNumber(contributor.phoneNumber);

  try {
    if (combinedMessage.length <= 160) {
      await sendSMS(phone, combinedMessage);
    } else {
      await sendSMS(phone, intro);
      await sendSMS(phone, linkMessage);
      await sendSMS(phone, emberMessage);
    }

    await prisma.contributor.update({
      where: { id: contributorId },
      data: { inviteSent: true },
    });

    return { success: true, inviteUrl: shortInviteUrl };
  } catch (error) {
    console.error(`Failed to send SMS to ${phone}:`, error);
    return {
      success: false,
      inviteUrl: shortInviteUrl,
      error: error instanceof Error ? error.message : 'Failed to send SMS invite',
    };
  }
}
