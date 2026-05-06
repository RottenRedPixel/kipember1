import { prisma } from '@/lib/db';
import { getUserDisplayName } from '@/lib/user-name';

/**
 * One row per unique person across all the user's owned embers.
 *
 * Now backed directly by the owner-scoped Contributor pool (one row per
 * (owner, person)). Each pool entry has zero or more EmberContributor join
 * rows for the embers they're attached to.
 *
 * When `currentEmberId` is provided, each row carries:
 * - `onThisEmber` — true if this person has an EmberContributor on that ember
 * - `currentEmberContributorId` — the EmberContributor.id on that ember (or null)
 */
export type UnifiedContributor = {
  /** Stable dedupe key — also used as `sourceKey` when adding to an ember. */
  key: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  avatarColor: string | null;
  avatarUrl: string | null;
  /** Embers across the user's pool that this person is on. */
  embers: { id: string; title: string; contributorId: string }[];
  emberCount: number;
  /** Photos across the owner's embers where this person is tagged with a face box. */
  taggedPhotos: TaggedPhoto[];
  taggedPhotoCount: number;
  /** Only meaningful when currentEmberId is given. */
  onThisEmber: boolean;
  currentEmberContributorId: string | null;
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

function pickKey(c: { userId: string | null; email: string | null; phoneNumber: string | null; id: string }): string {
  if (c.userId) return `u:${c.userId}`;
  if (c.email) return `e:${c.email.toLowerCase()}`;
  if (c.phoneNumber) return `p:${c.phoneNumber}`;
  return `r:${c.id}`;
}

// Share-link contributors are placeholder rows with all 4 identity fields null.
// They exist only to anchor the share token + guest chat session, and must
// never surface in any contributor display or count.
export const realContributorWhere = {
  OR: [
    { userId: { not: null } },
    { email: { not: null } },
    { phoneNumber: { not: null } },
    { name: { not: null } },
  ],
};

export async function getUnifiedContributorsForUser(
  userId: string,
  currentEmberId?: string | null
): Promise<UnifiedContributor[]> {
  const rows = await prisma.contributor.findMany({
    where: {
      ownerId: userId,
      // Skip the owner's own pool row (the contributor record that points
      // back at the owner's user account).
      AND: [
        { OR: [{ userId: null }, { NOT: { userId } }] },
        realContributorWhere,
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      avatarColor: true,
      userId: true,
      user: { select: { firstName: true, lastName: true, email: true, avatarFilename: true } },
      emberContributors: {
        select: {
          id: true,
          imageId: true,
          image: { select: { id: true, title: true, originalName: true } },
        },
      },
    },
  });

  const byKey = new Map<string, UnifiedContributor>();
  const poolIdToKey = new Map<string, string>();
  const emberContribIdToKey = new Map<string, string>();
  const userIdToKey = new Map<string, string>();
  const emberTitles = new Map<string, string>();

  for (const r of rows) {
    const key = pickKey(r);
    poolIdToKey.set(r.id, key);
    if (r.userId) userIdToKey.set(r.userId, key);

    let entry = byKey.get(key);
    if (!entry) {
      const displayName =
        getUserDisplayName(r.user) ?? r.name ?? r.user?.email ?? r.email ?? r.phoneNumber ?? 'Contributor';
      entry = {
        key,
        name: displayName,
        email: r.email ?? r.user?.email ?? null,
        phoneNumber: r.phoneNumber ?? null,
        avatarColor: r.avatarColor ?? null,
        avatarUrl: r.user?.avatarFilename ? `/api/uploads/${r.user.avatarFilename}` : null,
        embers: [],
        emberCount: 0,
        taggedPhotos: [],
        taggedPhotoCount: 0,
        onThisEmber: false,
        currentEmberContributorId: null,
      };
      byKey.set(key, entry);
    }

    for (const ec of r.emberContributors) {
      const title = ec.image.title || ec.image.originalName.replace(/\.[^.]+$/, '');
      emberTitles.set(ec.image.id, title);
      emberContribIdToKey.set(ec.id, key);
      const isOnCurrent = currentEmberId ? ec.imageId === currentEmberId : false;
      entry.embers.push({ id: ec.image.id, title, contributorId: ec.id });
      entry.emberCount += 1;
      if (isOnCurrent) {
        entry.onThisEmber = true;
        entry.currentEmberContributorId = ec.id;
      }
    }
  }

  // Pull positioned tags that link (via emberContributorId or userId) to
  // anyone in the pool, so each unified entry knows which face crops to
  // display.
  const allEmberContribIds = Array.from(emberContribIdToKey.keys());
  const allUserIds = Array.from(userIdToKey.keys());

  if (allEmberContribIds.length > 0 || allUserIds.length > 0) {
    const tagFilters: Array<Record<string, unknown>> = [];
    if (allEmberContribIds.length > 0) tagFilters.push({ emberContributorId: { in: allEmberContribIds } });
    if (allUserIds.length > 0) tagFilters.push({ userId: { in: allUserIds } });

    const tags = await prisma.imageTag.findMany({
      where: {
        image: { ownerId: userId },
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
        image: {
          select: {
            filename: true,
            mediaType: true,
            posterFilename: true,
          },
        },
      },
    });

    const seenTagPerKey = new Map<string, Set<string>>();
    for (const t of tags) {
      const key =
        (t.emberContributorId && emberContribIdToKey.get(t.emberContributorId)) ||
        (t.userId && userIdToKey.get(t.userId)) ||
        null;
      if (!key) continue;
      const entry = byKey.get(key);
      if (!entry) continue;

      // Dedupe on (key, imageId) — at most one tag thumbnail per ember.
      const seen = seenTagPerKey.get(key) ?? new Set<string>();
      if (seen.has(t.imageId)) continue;
      seen.add(t.imageId);
      seenTagPerKey.set(key, seen);

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

  // Sort: people on the current ember first (when scoped), then by name.
  const list = Array.from(byKey.values());
  list.sort((a, b) => {
    if (currentEmberId) {
      if (a.onThisEmber !== b.onThisEmber) return a.onThisEmber ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  return list;
}
