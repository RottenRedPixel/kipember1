import { randomBytes, randomUUID, scryptSync } from 'crypto';
import { prisma } from '@/lib/db';

const GUEST_EMAIL_DOMAIN = 'guest.ember.local';

export function isGuestUserEmail(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}

function hashGuestPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
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

export async function createGuestOwnerUser() {
  return prisma.user.create({
    data: {
      email: `guest-${randomUUID()}@${GUEST_EMAIL_DOMAIN}`,
      passwordHash: hashGuestPassword(randomUUID()),
      firstName: null,
      lastName: null,
      phoneNumber: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
    },
  });
}

export async function claimGuestMemoriesForUser({
  userId,
  displayName,
  email,
  phoneNumber,
}: {
  userId: string;
  displayName: string | null;
  email: string;
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
  const guestImages = await prisma.image.findMany({
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

  const imageIds = guestImages.map((image) => image.id);

  await prisma.$transaction(async (tx) => {
    await tx.image.updateMany({
      where: {
        id: {
          in: imageIds,
        },
      },
      data: {
        ownerId: userId,
      },
    });

    await tx.contributor.updateMany({
      where: {
        imageId: {
          in: imageIds,
        },
        userId: {
          in: guestOwnerIds,
        },
      },
      data: {
        userId,
        name: displayName,
        email,
        phoneNumber: normalizedPhone,
      },
    });
  });

  return imageIds.length;
}
