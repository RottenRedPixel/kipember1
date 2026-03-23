import { prisma } from '@/lib/db';

export type ImageAccessType = 'owner' | 'contributor' | 'network';

export async function getAcceptedFriends(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
        },
      },
      addressee: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return friendships.map((friendship) =>
    friendship.requesterId === userId ? friendship.addressee : friendship.requester
  );
}

export async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  const friends = await getAcceptedFriends(userId);
  return friends.map((friend) => friend.id);
}

export async function getImageAccessType(
  userId: string,
  imageId: string
): Promise<ImageAccessType | null> {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: {
      ownerId: true,
      shareToNetwork: true,
      contributors: {
        where: { userId },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!image) {
    return null;
  }

  if (image.ownerId === userId) {
    return 'owner';
  }

  if (image.contributors.length > 0) {
    return 'contributor';
  }

  if (!image.shareToNetwork) {
    return null;
  }

  const friendIds = await getAcceptedFriendIds(userId);
  return friendIds.includes(image.ownerId) ? 'network' : null;
}

export async function ensureImageOwnerAccess(userId: string, imageId: string) {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: { id: true, ownerId: true },
  });

  if (!image || image.ownerId !== userId) {
    return null;
  }

  return image;
}

export async function ensureOwnedContributorAccess(userId: string, contributorId: string) {
  const contributor = await prisma.contributor.findUnique({
    where: { id: contributorId },
    include: {
      image: {
        select: {
          id: true,
          ownerId: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
        },
      },
    },
  });

  if (!contributor || contributor.image.ownerId !== userId) {
    return null;
  }

  return contributor;
}

export async function ensureContributorRemovalAccess(userId: string, contributorId: string) {
  const contributor = await prisma.contributor.findUnique({
    where: { id: contributorId },
    include: {
      image: {
        select: {
          id: true,
          ownerId: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
        },
      },
    },
  });

  if (!contributor) {
    return null;
  }

  const canManageAsOwner = contributor.image.ownerId === userId;
  const canRemoveSelf = contributor.userId === userId;

  if (!canManageAsOwner && !canRemoveSelf) {
    return null;
  }

  return {
    contributor,
    removalMode: canManageAsOwner ? 'owner' : 'self' as const,
  };
}
