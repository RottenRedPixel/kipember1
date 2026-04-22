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
      cropX: true,
      cropY: true,
      contributors: {
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

  const value = images.map<AccessibleImageSummary>((image) => {
    const nonOwnerContributors = image.contributors.filter(
      (c) => c.userId !== image.ownerId
    );
    return {
      id: image.id,
      filename: image.filename,
      mediaType: image.mediaType,
      posterFilename: image.posterFilename,
      durationSeconds: image.durationSeconds,
      originalName: image.originalName,
      title: image.title,
      description: image.description,
      createdAt: image.createdAt,
      capturedAt: image.analysis?.capturedAt ?? null,
      shareToNetwork: image.shareToNetwork,
      photoCount: 1 + image.attachments.length,
      contributorCount: nonOwnerContributors.length,
      hasWiki: image.wiki != null,
      hasLocation: image.analysis?.latitude != null,
      hasVoiceCall: image.contributors.some((c) => c.voiceCalls.length > 0),
      accessType:
        image.ownerId === userId
          ? 'owner'
          : image.contributors.some((c) => c.userId === userId)
            ? 'contributor'
            : 'network',
      cropX: image.cropX ?? null,
      cropY: image.cropY ?? null,
    };
  });

  accessibleImageSummaryCache.set(userId, {
    expiresAt: Date.now() + IMAGE_SUMMARY_CACHE_TTL_MS,
    value,
  });

  return value;
}
