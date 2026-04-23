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
  cropWidth: number | null;
  cropHeight: number | null;
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

export async function getTotalContributorsForUser(userId: string) {
  const contributors = await prisma.contributor.findMany({
    where: { image: { ownerId: userId } },
    select: { id: true, userId: true, email: true, phoneNumber: true },
  });

  const seen = new Set<string>();
  for (const c of contributors) {
    if (c.userId === userId) continue;
    const key = c.userId ?? c.email?.toLowerCase() ?? c.phoneNumber ?? `row:${c.id}`;
    seen.add(key);
  }
  return seen.size;
}

export type ContributorSummary = {
  key: string;
  name: string;
  avatarUrl: string | null;
  joinedAt: Date;
};

export async function getContributorsListForUser(userId: string): Promise<ContributorSummary[]> {
  const rows = await prisma.contributor.findMany({
    where: { image: { ownerId: userId } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      userId: true,
      name: true,
      email: true,
      phoneNumber: true,
      createdAt: true,
      user: { select: { name: true, email: true, avatarFilename: true } },
    },
  });

  const byKey = new Map<string, ContributorSummary>();
  for (const r of rows) {
    if (r.userId === userId) continue;
    const key = r.userId ?? r.email?.toLowerCase() ?? r.phoneNumber ?? `row:${r.id}`;
    if (byKey.has(key)) continue;
    const name =
      r.user?.name ??
      r.name ??
      r.user?.email ??
      r.email ??
      r.phoneNumber ??
      'Contributor';
    const avatarUrl = r.user?.avatarFilename ? `/api/uploads/${r.user.avatarFilename}` : null;
    byKey.set(key, { key, name, avatarUrl, joinedAt: r.createdAt });
  }

  return Array.from(byKey.values()).sort(
    (a, b) => b.joinedAt.getTime() - a.joinedAt.getTime()
  );
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
      cropWidth: true,
      cropHeight: true,
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
      cropWidth: image.cropWidth ?? null,
      cropHeight: image.cropHeight ?? null,
    };
  });

  accessibleImageSummaryCache.set(userId, {
    expiresAt: Date.now() + IMAGE_SUMMARY_CACHE_TTL_MS,
    value,
  });

  return value;
}
