import { prisma } from '@/lib/db';
import { getUserDisplayName } from '@/lib/user-name';

const FACEPILE_COLORS = ['#7c3aed', '#0891b2', '#16a34a', '#b45309', '#db2777', '#2563eb', '#d97706', '#9333ea'];

function colorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return FACEPILE_COLORS[hash % FACEPILE_COLORS.length];
}

function initialsFor(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

export type HomeActivityFace = {
  key: string;
  name: string;
  initials: string;
  color: string;
  avatarUrl: string | null;
};

// Fields needed to build a thumbnail via getPreviewMediaUrl on the client.
export type HomeActivityThumb = {
  mediaType: string;
  filename: string;
  posterFilename: string | null;
};

// One row per ember with new activity (contributions or wiki updates).
export type HomeActivityItem = {
  emberId: string;
  emberTitle: string | null;
  thumb: HomeActivityThumb;
  count: number;        // contributions: new messages on this ember; wiki: 1 per updated wiki
  at: Date;             // latest activity time — used for sort, relative time, and mark-seen watermark
  faces?: HomeActivityFace[]; // contributions only
};

export type HomeActivityKind = {
  items: HomeActivityItem[];
};

export type HomeActivity = {
  contributions: HomeActivityKind;
  wikiUpdates: HomeActivityKind;
  guestViews: HomeActivityKind;
};

// Upper bound on messages fetched to build contributions cards. In practice we expect
// only a handful of active embers at once; this cap just keeps the query cheap.
const MAX_RECENT_MESSAGES = 300;
const MAX_FACES_PER_EMBER = 4;

/**
 * Computes "new since last home visit" activity for the owner's dashboard.
 *
 * Returns one card per ember that has new activity:
 * - Contribution card per ember = EmberMessage rows from non-owner sessions on
 *   that ember created after `lastSeenContributionsAt`, grouped by emberId.
 * - Wiki card per ember = a Wiki row on an owned ember whose `updatedAt` is
 *   after `lastSeenWikiAt`.
 *
 * Null `lastSeen*` means "never seen" — all rows are considered new.
 *
 * Does NOT stamp lastSeen*. That happens server-side in /api/home/mark-seen
 * when the user swipes a card to dismiss it.
 */
export async function getHomeActivity(userId: string): Promise<HomeActivity> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastSeenContributionsAt: true, lastSeenWikiAt: true, lastSeenGuestViewsAt: true },
  });

  const sinceContributions = user?.lastSeenContributionsAt ?? null;
  const sinceWiki = user?.lastSeenWikiAt ?? null;
  const sinceGuestViews = user?.lastSeenGuestViewsAt ?? null;

  // --- Contributions: fetch raw messages + session + image, group by ember in JS ---
  const messages = await prisma.emberMessage.findMany({
    where: {
      role: 'user',
      session: {
        participantType: { not: 'owner' },
        image: { ownerId: userId },
      },
      ...(sinceContributions ? { createdAt: { gt: sinceContributions } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_RECENT_MESSAGES,
    select: {
      createdAt: true,
      session: {
        select: {
          participantType: true,
          participantId: true,
          personaName: true,
          emberContributor: {
            select: {
              id: true,
              userId: true,
              user: { select: { id: true, firstName: true, lastName: true, email: true, avatarFilename: true } },
            },
          },
          user: { select: { id: true, firstName: true, lastName: true, email: true, avatarFilename: true } },
          image: {
            select: { id: true, title: true, mediaType: true, filename: true, posterFilename: true },
          },
        },
      },
    },
  });

  // Group messages by ember. For each ember collect: count, latest at, faces, thumb.
  type EmberBucket = {
    emberId: string;
    emberTitle: string | null;
    thumb: HomeActivityThumb;
    count: number;
    at: Date;
    facesByKey: Map<string, HomeActivityFace>;
  };
  const buckets = new Map<string, EmberBucket>();

  for (const m of messages) {
    const img = m.session.image;
    let bucket = buckets.get(img.id);
    if (!bucket) {
      bucket = {
        emberId: img.id,
        emberTitle: img.title,
        thumb: {
          mediaType: img.mediaType,
          filename: img.filename,
          posterFilename: img.posterFilename,
        },
        count: 0,
        at: m.createdAt,
        facesByKey: new Map(),
      };
      buckets.set(img.id, bucket);
    }
    bucket.count += 1;
    if (m.createdAt > bucket.at) bucket.at = m.createdAt;

    // Record the participant's face if we don't already have MAX_FACES_PER_EMBER.
    if (bucket.facesByKey.size < MAX_FACES_PER_EMBER) {
      const s = m.session;
      const ecUser = s.emberContributor?.user ?? null;
      const linkedUser = s.user ?? ecUser;
      let key: string;
      let name: string;
      let avatarUrl: string | null = null;
      if (linkedUser) {
        key = `u:${linkedUser.id}`;
        name = getUserDisplayName(linkedUser) || linkedUser.email || 'Contributor';
        avatarUrl = linkedUser.avatarFilename ? `/api/uploads/${linkedUser.avatarFilename}` : null;
      } else {
        key = `g:${s.participantType}:${s.participantId}`;
        name = s.personaName || 'Guest';
      }
      if (!bucket.facesByKey.has(key)) {
        bucket.facesByKey.set(key, {
          key,
          name,
          initials: initialsFor(name),
          color: colorForKey(key),
          avatarUrl,
        });
      }
    }
  }

  const contributionItems: HomeActivityItem[] = Array.from(buckets.values())
    .map((b) => ({
      emberId: b.emberId,
      emberTitle: b.emberTitle,
      thumb: b.thumb,
      count: b.count,
      at: b.at,
      faces: Array.from(b.facesByKey.values()),
    }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  // --- Wiki updates: one row per ember whose wiki was updated since lastSeenWikiAt ---
  const wikis = await prisma.wiki.findMany({
    where: {
      image: { ownerId: userId },
      ...(sinceWiki ? { updatedAt: { gt: sinceWiki } } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      updatedAt: true,
      image: {
        select: { id: true, title: true, mediaType: true, filename: true, posterFilename: true },
      },
    },
  });

  const wikiItems: HomeActivityItem[] = wikis.map((w) => ({
    emberId: w.image.id,
    emberTitle: w.image.title,
    thumb: {
      mediaType: w.image.mediaType,
      filename: w.image.filename,
      posterFilename: w.image.posterFilename,
    },
    count: 1,
    at: w.updatedAt,
  }));

  // --- Guest views: GuestView rows on EmberContributors on embers owned by this user.
  const guestViews = await prisma.guestView.findMany({
    where: {
      emberContributor: { image: { ownerId: userId } },
      ...(sinceGuestViews ? { viewedAt: { gt: sinceGuestViews } } : {}),
    },
    orderBy: { viewedAt: 'desc' },
    take: MAX_RECENT_MESSAGES, // same upper bound as contributions — good enough
    select: {
      viewedAt: true,
      emberContributor: {
        select: {
          image: {
            select: { id: true, title: true, mediaType: true, filename: true, posterFilename: true },
          },
        },
      },
    },
  });

  type GuestBucket = { emberId: string; emberTitle: string | null; thumb: HomeActivityThumb; count: number; at: Date };
  const guestBuckets = new Map<string, GuestBucket>();
  for (const gv of guestViews) {
    const img = gv.emberContributor.image;
    let bucket = guestBuckets.get(img.id);
    if (!bucket) {
      bucket = {
        emberId: img.id,
        emberTitle: img.title,
        thumb: { mediaType: img.mediaType, filename: img.filename, posterFilename: img.posterFilename },
        count: 0,
        at: gv.viewedAt,
      };
      guestBuckets.set(img.id, bucket);
    }
    bucket.count += 1;
    if (gv.viewedAt > bucket.at) bucket.at = gv.viewedAt;
  }
  const guestViewItems: HomeActivityItem[] = Array.from(guestBuckets.values())
    .map((b) => ({ emberId: b.emberId, emberTitle: b.emberTitle, thumb: b.thumb, count: b.count, at: b.at }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  return {
    contributions: { items: contributionItems },
    wikiUpdates: { items: wikiItems },
    guestViews: { items: guestViewItems },
  };
}
