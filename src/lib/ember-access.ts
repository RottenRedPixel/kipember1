import { prisma } from '@/lib/db';

export type EmberAccessType = 'owner' | 'contributor' | 'network';

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
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
        },
      },
      addressee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
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
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: {
      requesterId: true,
      addresseeId: true,
    },
  });

  return friendships.map((friendship) =>
    friendship.requesterId === userId ? friendship.addresseeId : friendship.requesterId
  );
}

async function isAcceptedFriend(userId: string, otherUserId: string) {
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: userId, addresseeId: otherUserId },
        { requesterId: otherUserId, addresseeId: userId },
      ],
    },
    select: { id: true },
  });

  return Boolean(friendship);
}

export async function getEmberAccessType(
  userId: string,
  imageId: string
): Promise<EmberAccessType | null> {
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

  return (await isAcceptedFriend(userId, image.ownerId)) ? 'network' : null;
}

export async function ensureEmberOwnerAccess(userId: string, imageId: string) {
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
          firstName: true,
          lastName: true,
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
          firstName: true,
          lastName: true,
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
