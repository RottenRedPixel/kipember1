import { prisma } from '@/lib/db';
import { getAcceptedFriendIds } from '@/lib/ember-access';
import type { EmberMediaType } from '@/lib/media';

const IMAGE_SUMMARY_CACHE_TTL_MS = 15_000;

export type AccessibleImageSummary = {
  id: string;
  filename: string;
  mediaType: EmberMediaType;
  posterFilename: string | null;
  durationSeconds: number | null;
  originalName: string;
  title: string | null;
  description: string | null;
  createdAt: Date;
  shareToNetwork: boolean;
  accessType: 'owner' | 'contributor' | 'network';
};

const globalForImageSummaries = globalThis as unknown as {
  accessibleImageSummaryCache?: Map<
    string,
    { expiresAt: number; value: AccessibleImageSummary[] }
  >;
};

const accessibleImageSummaryCache =
  globalForImageSummaries.accessibleImageSummaryCache ??
  new Map<string, { expiresAt: number; value: AccessibleImageSummary[] }>();

if (process.env.NODE_ENV !== 'production') {
  globalForImageSummaries.accessibleImageSummaryCache = accessibleImageSummaryCache;
}

export function invalidateAccessibleImagesForUser(userId: string) {
  accessibleImageSummaryCache.delete(userId);
}

export async function getAccessibleImagesForUser(userId: string) {
  const cached = accessibleImageSummaryCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const friendIds = await getAcceptedFriendIds(userId);

  const images = await prisma.image.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { contributors: { some: { userId } } },
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
      contributors: {
        where: { userId },
        select: { id: true },
        take: 1,
      },
    },
  });

  const value = images.map<AccessibleImageSummary>((image) => ({
    id: image.id,
    filename: image.filename,
    mediaType: image.mediaType,
    posterFilename: image.posterFilename,
    durationSeconds: image.durationSeconds,
    originalName: image.originalName,
    title: image.title,
    description: image.description,
    createdAt: image.createdAt,
    shareToNetwork: image.shareToNetwork,
    accessType:
      image.ownerId === userId
        ? 'owner'
        : image.contributors.length > 0
          ? 'contributor'
          : 'network',
  }));

  accessibleImageSummaryCache.set(userId, {
    expiresAt: Date.now() + IMAGE_SUMMARY_CACHE_TTL_MS,
    value,
  });

  return value;
}
