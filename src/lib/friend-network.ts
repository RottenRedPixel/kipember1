import { prisma } from '@/lib/db';

const FRIEND_NETWORK_CACHE_TTL_MS = 15_000;

export type FriendProfile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phoneNumber: string | null;
};

export type FriendNetworkPayload = {
  friends: Array<{
    id: string;
    user: FriendProfile;
  }>;
  incomingRequests: Array<{
    id: string;
    user: FriendProfile;
    createdAt: Date;
  }>;
  outgoingRequests: Array<{
    id: string;
    user: FriendProfile;
    createdAt: Date;
  }>;
};

const globalForFriendNetwork = globalThis as unknown as {
  friendNetworkCache?: Map<string, { expiresAt: number; value: FriendNetworkPayload }>;
};

const friendNetworkCache =
  globalForFriendNetwork.friendNetworkCache ??
  new Map<string, { expiresAt: number; value: FriendNetworkPayload }>();

if (process.env.NODE_ENV !== 'production') {
  globalForFriendNetwork.friendNetworkCache = friendNetworkCache;
}

export function invalidateFriendNetworkForUser(userId: string) {
  friendNetworkCache.delete(userId);
}

function toCounterpartyUser(
  friendship: {
    requesterId: string;
    requester: FriendProfile;
    addressee: FriendProfile;
  },
  currentUserId: string
) {
  return friendship.requesterId === currentUserId
    ? friendship.addressee
    : friendship.requester;
}

export async function getFriendNetworkForUser(
  userId: string
): Promise<FriendNetworkPayload> {
  const cached = friendNetworkCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: {
        select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
      },
      addressee: {
        select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const value = {
    friends: friendships
      .filter((friendship) => friendship.status === 'accepted')
      .map((friendship) => ({
        id: friendship.id,
        user: toCounterpartyUser(friendship, userId),
      })),
    incomingRequests: friendships
      .filter(
        (friendship) =>
          friendship.status === 'pending' && friendship.addresseeId === userId
      )
      .map((friendship) => ({
        id: friendship.id,
        user: friendship.requester,
        createdAt: friendship.createdAt,
      })),
    outgoingRequests: friendships
      .filter(
        (friendship) =>
          friendship.status === 'pending' && friendship.requesterId === userId
      )
      .map((friendship) => ({
        id: friendship.id,
        user: friendship.addressee,
        createdAt: friendship.createdAt,
      })),
  };

  friendNetworkCache.set(userId, {
    expiresAt: Date.now() + FRIEND_NETWORK_CACHE_TTL_MS,
    value,
  });

  return value;
}
