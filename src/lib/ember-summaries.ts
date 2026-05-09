import { prisma } from '@/lib/db';
import { realContributorWhere } from '@/lib/contributors-pool';
import { getAcceptedFriendIds } from '@/lib/ember-access';
import type { EmberMediaType } from '@/lib/media';
import { getUserDisplayName } from '@/lib/user-name';

const EMBER_SUMMARY_CACHE_TTL_MS = 15_000;

export type EmberSummary = {
  id: string;
  filename: string;
  mediaType: EmberMediaType;
  posterFilename: string | null;
  durationSeconds: number | null;
  originalName: string;
  title: string | null;
  description: string | null;
  createdAt: Date;
  capturedAt: Date | null;
  shareToNetwork: boolean;
  accessType: 'owner' | 'contributor' | 'network';
  photoCount: number;
  contributorCount: number;
  hasWiki: boolean;
  hasLocation: boolean;
  hasVoiceCall: boolean;
  cropX: number | null;
  cropY: number | null;
  cropWidth: number | null;
  cropHeight: number | null;
};

const globalForEmberSummaries = globalThis as unknown as {
  accessibleEmberSummaryCache?: Map<
    string,
    { expiresAt: number; value: EmberSummary[] }
  >;
};

const accessibleEmberSummaryCache =
  globalForEmberSummaries.accessibleEmberSummaryCache ??
  new Map<string, { expiresAt: number; value: EmberSummary[] }>();

if (process.env.NODE_ENV !== 'production') {
  globalForEmberSummaries.accessibleEmberSummaryCache = accessibleEmberSummaryCache;
}

export function invalidateAccessibleEmbersForUser(userId: string) {
  accessibleEmberSummaryCache.delete(userId);
}

export async function getTotalContributorsForUser(userId: string) {
  // Count distinct users who contribute to at least one ember owned by this user,
  // excluding the owner themselves.
  const contributors = await prisma.emberContributor.findMany({
    where: {
      ember: { ownerId: userId },
      NOT: { userId: userId },
    },
    select: { userId: true },
    distinct: ['userId'],
  });

  return contributors.length;
}

export type ContributorSummary = {
  key: string;
  contributorId: string;
  emberId: string;
  name: string;
  avatarUrl: string | null;
  joinedAt: Date;
};

export async function getContributorsListForUser(userId: string): Promise<ContributorSummary[]> {
  const rows = await prisma.emberContributor.findMany({
    where: {
      ember: { ownerId: userId },
      NOT: { userId: userId },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      userId: true,
      emberId: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true, email: true, phoneNumber: true, avatarFilename: true } },
    },
  });

  const byKey = new Map<string, ContributorSummary>();
  for (const r of rows) {
    const key = r.userId;
    if (byKey.has(key)) continue;
    const name =
      getUserDisplayName(r.user) ??
      r.user?.email ??
      r.user?.phoneNumber ??
      'Contributor';
    const avatarUrl = r.user?.avatarFilename ? `/api/uploads/${r.user.avatarFilename}` : null;
    byKey.set(key, {
      key,
      contributorId: r.id,
      emberId: r.emberId,
      name,
      avatarUrl,
      joinedAt: r.createdAt,
    });
  }

  return Array.from(byKey.values()).sort(
    (a, b) => b.joinedAt.getTime() - a.joinedAt.getTime()
  );
}

export async function getAccessibleEmbersForUser(userId: string) {
  const cached = accessibleEmberSummaryCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const friendIds = await getAcceptedFriendIds(userId);

  const images = await prisma.ember.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { emberContributors: { some: { userId } } },
        ...(friendIds.length > 0
          ? [{ shareToNetwork: true, ownerId: { in: friendIds } }]
          : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      ownerId: true,
      filename: true,
      mediaType: true,
      posterFilename: true,
      durationSeconds: true,
      originalName: true,
      title: true,
      description: true,
      createdAt: true,
      shareToNetwork: true,
      cropX: true,
      cropY: true,
      cropWidth: true,
      cropHeight: true,
      emberContributors: {
        select: {
          id: true,
          userId: true,
          voiceCalls: { select: { id: true }, take: 1 },
        },
      },
      analysis: {
        select: { capturedAt: true, latitude: true },
      },
      attachments: {
        where: { mediaType: { in: ['IMAGE', 'VIDEO'] } },
        select: { id: true },
      },
      wiki: {
        select: { id: true },
      },
    },
  });

  const value = images.map<EmberSummary>((ember) => {
    const nonOwnerContributors = ember.emberContributors.filter(
      (c) => c.userId !== ember.ownerId
    );
    return {
      id: ember.id,
      filename: ember.filename,
      mediaType: ember.mediaType,
      posterFilename: ember.posterFilename,
      durationSeconds: ember.durationSeconds,
      originalName: ember.originalName,
      title: ember.title,
      description: ember.description,
      createdAt: ember.createdAt,
      capturedAt: ember.analysis?.capturedAt ?? null,
      shareToNetwork: ember.shareToNetwork,
      photoCount: 1 + ember.attachments.length,
      contributorCount: nonOwnerContributors.length,
      hasWiki: ember.wiki != null,
      hasLocation: ember.analysis?.latitude != null,
      hasVoiceCall: ember.emberContributors.some((c) => c.voiceCalls.length > 0),
      accessType:
        ember.ownerId === userId
          ? 'owner'
          : ember.emberContributors.some((c) => c.userId === userId)
            ? 'contributor'
            : 'network',
      cropX: ember.cropX ?? null,
      cropY: ember.cropY ?? null,
      cropWidth: ember.cropWidth ?? null,
      cropHeight: ember.cropHeight ?? null,
    };
  });

  accessibleEmberSummaryCache.set(userId, {
    expiresAt: Date.now() + EMBER_SUMMARY_CACHE_TTL_MS,
    value,
  });

  return value;
}
