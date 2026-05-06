import { prisma } from '@/lib/db';
import { getUserDisplayName } from '@/lib/user-name';

/**
 * One row per unique contributor (User) across all the owner's embers.
 *
 * Backed directly by EmberContributor JOIN User — no intermediate pool
 * table. Each row represents a user who has been added as a contributor
 * to at least one of the owner's embers.
 *
 * When `currentEmberId` is provided each row carries:
 * - `onThisEmber` — true if this user has an EmberContributor on that ember
 * - `currentEmberContributorId` — the EmberContributor.id on that ember (or null)
 */
export type UnifiedContributor = {
  /** Stable key — equals userId. Used as sourceKey when adding to an ember. */
  key: string;
  userId: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  avatarColor: string | null;
  avatarUrl: string | null;
  /** Embers across the owner's embers that this person is on. */
  embers: { id: string; title: string; contributorId: string }[];
  emberCount: number;
  /** Photos across the owner's embers where this person is tagged with a face box. */
  taggedPhotos: TaggedPhoto[];
  taggedPhotoCount: number;
  /** Only meaningful when currentEmberId is given. */
  onThisEmber: boolean;
  currentEmberContributorId: string | null;
  inviteSent: boolean;
};

export type TaggedPhoto = {
  tagId: string;
  emberId: string;
  emberTitle: string;
  filename: string;
  posterFilename: string | null;
  mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO';
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
};

// In the new model every EmberContributor has a real User, so there are
// no anonymous placeholder rows to filter out. This export is kept for
// callers that still import it; it matches everything.
export const realContributorWhere = {};

export async function getUnifiedContributorsForUser(
  ownerId: string,
  currentEmberId?: string | null
): Promise<UnifiedContributor[]> {
  // Fetch all EmberContributors on embers owned by this user, excluding
  // the owner themselves (they own, not contribute).
  const rows = await prisma.emberContributor.findMany({
    where: {
      image: { ownerId },
      NOT: { userId: ownerId },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      imageId: true,
      inviteSent: true,
      userId: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          avatarFilename: true,
        },
      },
      image: { select: { id: true, title: true, originalName: true } },
    },
  });

  const byUserId = new Map<string, UnifiedContributor>();
  const emberContribIdToUserId = new Map<string, string>();
  const emberTitles = new Map<string, string>();

  for (const r of rows) {
    const userId = r.userId;
    emberContribIdToUserId.set(r.id, userId);

    const title = r.image.title || r.image.originalName.replace(/\.[^.]+$/, '');
    emberTitles.set(r.image.id, title);

    let entry = byUserId.get(userId);
    if (!entry) {
      const displayName = getUserDisplayName(r.user) ?? r.user.email ?? r.user.phoneNumber ?? 'Contributor';
      entry = {
        key: userId,
        userId,
        name: displayName,
        email: r.user.email ?? null,
        phoneNumber: r.user.phoneNumber ?? null,
        avatarColor: null,
        avatarUrl: r.user.avatarFilename ? `/api/uploads/${r.user.avatarFilename}` : null,
        embers: [],
        emberCount: 0,
        taggedPhotos: [],
        taggedPhotoCount: 0,
        onThisEmber: false,
        currentEmberContributorId: null,
        inviteSent: false,
      };
      byUserId.set(userId, entry);
    }

    entry.embers.push({ id: r.image.id, title, contributorId: r.id });
    entry.emberCount += 1;

    if (currentEmberId && r.imageId === currentEmberId) {
      entry.onThisEmber = true;
      entry.currentEmberContributorId = r.id;
      entry.inviteSent = r.inviteSent;
    }
  }

  // Pull positioned tags linked to any of these contributors.
  const allEmberContribIds = Array.from(emberContribIdToUserId.keys());
  const allUserIds = Array.from(byUserId.keys());

  if (allEmberContribIds.length > 0 || allUserIds.length > 0) {
    const tagFilters: Array<Record<string, unknown>> = [];
    if (allEmberContribIds.length > 0) tagFilters.push({ emberContributorId: { in: allEmberContribIds } });
    if (allUserIds.length > 0) tagFilters.push({ userId: { in: allUserIds } });

    const tags = await prisma.imageTag.findMany({
      where: {
        image: { ownerId },
        leftPct: { not: null },
        topPct: { not: null },
        widthPct: { not: null },
        heightPct: { not: null },
        OR: tagFilters,
      },
      select: {
        id: true,
        emberContributorId: true,
        userId: true,
        imageId: true,
        leftPct: true,
        topPct: true,
        widthPct: true,
        heightPct: true,
        image: { select: { filename: true, mediaType: true, posterFilename: true } },
      },
    });

    const seenTagPerUser = new Map<string, Set<string>>();
    for (const t of tags) {
      const userId =
        (t.emberContributorId && emberContribIdToUserId.get(t.emberContributorId)) ||
        (t.userId && byUserId.has(t.userId) ? t.userId : null) ||
        null;
      if (!userId) continue;
      const entry = byUserId.get(userId);
      if (!entry) continue;

      const seen = seenTagPerUser.get(userId) ?? new Set<string>();
      if (seen.has(t.imageId)) continue;
      seen.add(t.imageId);
      seenTagPerUser.set(userId, seen);

      entry.taggedPhotos.push({
        tagId: t.id,
        emberId: t.imageId,
        emberTitle: emberTitles.get(t.imageId) ?? 'Ember',
        filename: t.image.filename,
        posterFilename: t.image.posterFilename,
        mediaType: t.image.mediaType,
        leftPct: t.leftPct ?? 0,
        topPct: t.topPct ?? 0,
        widthPct: t.widthPct ?? 0,
        heightPct: t.heightPct ?? 0,
      });
      entry.taggedPhotoCount += 1;
    }
  }

  const list = Array.from(byUserId.values());
  list.sort((a, b) => {
    if (currentEmberId) {
      if (a.onThisEmber !== b.onThisEmber) return a.onThisEmber ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  return list;
}
