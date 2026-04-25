import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { prisma } from '@/lib/db';

/**
 * POST /api/contributors/add-existing
 *
 * Body: { imageId: string, sourceKey: string }
 *
 * Adds a person from the owner's existing contributor pool to a different
 * ember they own. The `sourceKey` is the dedupe key produced by
 * `getUnifiedContributorsForUser` (e.g. "u:cmofXX", "e:foo@bar.com", "p:+15551212").
 *
 * Resolves the source identity from any prior Contributor row that matches
 * the key and clones it onto the target image. Idempotent: if a row already
 * exists on `imageId` with matching identity, the existing one is returned.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { imageId?: unknown; sourceKey?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const imageId = typeof body.imageId === 'string' ? body.imageId : '';
  const sourceKey = typeof body.sourceKey === 'string' ? body.sourceKey : '';
  if (!imageId || !sourceKey) {
    return NextResponse.json({ error: 'imageId and sourceKey are required' }, { status: 400 });
  }

  // Confirm the user owns the target image.
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: { ownerId: true },
  });
  if (!image || image.ownerId !== auth.user.id) {
    return NextResponse.json({ error: 'Ember not found' }, { status: 404 });
  }

  // Decode the dedupe key to a lookup filter scoped to this owner's pool.
  // Source contributor must already exist on at least one of this owner's embers.
  const colonIdx = sourceKey.indexOf(':');
  const kind = colonIdx === -1 ? '' : sourceKey.slice(0, colonIdx);
  const value = colonIdx === -1 ? '' : sourceKey.slice(colonIdx + 1);

  let sourceWhere;
  if (kind === 'u' && value) {
    sourceWhere = { userId: value, image: { ownerId: auth.user.id } };
  } else if (kind === 'e' && value) {
    sourceWhere = { email: { equals: value, mode: 'insensitive' as const }, image: { ownerId: auth.user.id } };
  } else if (kind === 'p' && value) {
    sourceWhere = { phoneNumber: value, image: { ownerId: auth.user.id } };
  } else if (kind === 'r' && value) {
    sourceWhere = { id: value, image: { ownerId: auth.user.id } };
  } else {
    return NextResponse.json({ error: 'Invalid sourceKey' }, { status: 400 });
  }

  const source = await prisma.contributor.findFirst({
    where: sourceWhere,
    orderBy: { createdAt: 'asc' },
    select: {
      name: true,
      email: true,
      phoneNumber: true,
      userId: true,
    },
  });
  if (!source) {
    return NextResponse.json({ error: 'Source contributor not found in your pool' }, { status: 404 });
  }

  // Idempotency: if a row already exists on this ember matching the same identity, return it.
  // The Contributor model has a @@unique([imageId, userId]); we only enforce idempotency
  // for linked-account contributors here. For email/phone-only entries the unique constraint
  // doesn't apply, so we do an explicit findFirst.
  const existing = await prisma.contributor.findFirst({
    where: {
      imageId,
      OR: [
        source.userId ? { userId: source.userId } : { userId: '__never_match__' },
        source.email ? { email: { equals: source.email, mode: 'insensitive' as const } } : { id: '__never_match__' },
        source.phoneNumber ? { phoneNumber: source.phoneNumber } : { id: '__never_match__' },
      ],
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, contributorId: existing.id, alreadyOnEmber: true });
  }

  const created = await prisma.contributor.create({
    data: {
      imageId,
      userId: source.userId,
      name: source.name,
      email: source.email,
      phoneNumber: source.phoneNumber,
      // inviteSent stays false — they haven't been re-invited specifically for this ember yet.
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, contributorId: created.id, alreadyOnEmber: false });
}
