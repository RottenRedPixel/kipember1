import { prisma } from '@/lib/db';

const GUEST_EMAIL_DOMAIN = 'guest.ember.local';

export function isGuestUserEmail(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}

function normalizeGuestPhone(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  return digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;
}

export async function claimGuestMemoriesForUser({
  userId,
  displayName,
  email,
  phoneNumber,
}: {
  userId: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
}) {
  const normalizedPhone = normalizeGuestPhone(phoneNumber);
  if (!normalizedPhone) {
    return 0;
  }

  const guestOwners = await prisma.user.findMany({
    where: {
      phoneNumber: normalizedPhone,
      email: {
        endsWith: `@${GUEST_EMAIL_DOMAIN}`,
      },
    },
    select: {
      id: true,
    },
  });

  if (!guestOwners.length) {
    return 0;
  }

  const guestOwnerIds = guestOwners.map((owner) => owner.id);
  const guestImages = await prisma.ember.findMany({
    where: {
      ownerId: {
        in: guestOwnerIds,
      },
    },
    select: {
      id: true,
    },
  });

  if (!guestImages.length) {
    return 0;
  }

  const imageIds = guestImages.map((ember) => ember.id);

  await prisma.$transaction(async (tx) => {
    await tx.ember.updateMany({
      where: {
        id: {
          in: imageIds,
        },
      },
      data: {
        ownerId: userId,
      },
    });

    // Reassign every EmberContributor row that was linked to a guest user
    // to the now-claimed real user.
    await tx.emberContributor.updateMany({
      where: {
        userId: { in: guestOwnerIds },
      },
      data: {
        userId,
      },
    });

    // Update the guest user records themselves with the real identity data.
    const nameParts = (displayName || '').trim().split(/\s+/);
    await tx.user.updateMany({
      where: { id: { in: guestOwnerIds } },
      data: {
        firstName: nameParts[0] || null,
        lastName: nameParts.slice(1).join(' ') || null,
        email,
        phoneNumber: normalizedPhone,
      },
    });
  });

  return imageIds.length;
}
