import { prisma } from '@/lib/db';

/**
 * One row per unique person across all the user's owned embers.
 *
 * The dedupe key is `userId` if set, else lowercased email, else phone, else
 * the contributor row id (as a last-resort uniqueness fallback).
 *
 * When `currentEmberId` is provided, each row carries:
 * - `onThisEmber` — true if this person is already a contributor on that ember
 * - `currentEmberContributorId` — the Contributor.id on that ember (or null)
 *
 * This is the source of truth for both the /tend/contributors list (with the
 * "This Ember | All" filter) and the /account contributors roster.
 */
export type UnifiedContributor = {
  /** Stable dedupe key — also used as `sourceKey` when adding to an ember. */
  key: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  /** Embers across the user's pool that this person is on. */
  embers: { id: string; title: string; contributorId: string }[];
  emberCount: number;
  /** Only meaningful when currentEmberId is given. */
  onThisEmber: boolean;
  currentEmberContributorId: string | null;
};

function pickKey(c: { userId: string | null; email: string | null; phoneNumber: string | null; id: string }): string {
  if (c.userId) return `u:${c.userId}`;
  if (c.email) return `e:${c.email.toLowerCase()}`;
  if (c.phoneNumber) return `p:${c.phoneNumber}`;
  return `r:${c.id}`;
}

export async function getUnifiedContributorsForUser(
  userId: string,
  currentEmberId?: string | null
): Promise<UnifiedContributor[]> {
  const rows = await prisma.contributor.findMany({
    where: {
      image: { ownerId: userId },
      // Skip the owner's own row if they happen to also be a contributor on their own ember.
      OR: [{ userId: null }, { NOT: { userId } }],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      userId: true,
      imageId: true,
      user: { select: { name: true, email: true, avatarFilename: true } },
      image: { select: { id: true, title: true, originalName: true } },
    },
  });

  const byKey = new Map<string, UnifiedContributor>();
  for (const r of rows) {
    const key = pickKey(r);
    const title = r.image.title || r.image.originalName.replace(/\.[^.]+$/, '');
    const isOnCurrent = currentEmberId ? r.imageId === currentEmberId : false;

    let entry = byKey.get(key);
    if (!entry) {
      const displayName =
        r.user?.name ?? r.name ?? r.user?.email ?? r.email ?? r.phoneNumber ?? 'Contributor';
      entry = {
        key,
        name: displayName,
        email: r.email ?? r.user?.email ?? null,
        phoneNumber: r.phoneNumber ?? null,
        avatarUrl: r.user?.avatarFilename ? `/api/uploads/${r.user.avatarFilename}` : null,
        embers: [],
        emberCount: 0,
        onThisEmber: false,
        currentEmberContributorId: null,
      };
      byKey.set(key, entry);
    }

    entry.embers.push({ id: r.image.id, title, contributorId: r.id });
    entry.emberCount += 1;
    if (isOnCurrent) {
      entry.onThisEmber = true;
      entry.currentEmberContributorId = r.id;
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
