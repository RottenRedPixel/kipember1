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
  const colonIdx = sourceKey.indexOf(':');
  const kind = colonIdx === -1 ? '' : sourceKey.slice(0, colonIdx);
  const value = colonIdx === -1 ? '' : sourceKey.slice(colonIdx + 1);

  let sourceWhere;
  if (kind === 'u' && value) {
    sourceWhere = { ownerId: auth.user.id, userId: value };
  } else if (kind === 'e' && value) {
    sourceWhere = { ownerId: auth.user.id, email: { equals: value, mode: 'insensitive' as const } };
  } else if (kind === 'p' && value) {
    sourceWhere = { ownerId: auth.user.id, phoneNumber: value };
  } else if (kind === 'r' && value) {
    sourceWhere = { ownerId: auth.user.id, id: value };
  } else {
    return NextResponse.json({ error: 'Invalid sourceKey' }, { status: 400 });
  }

  const source = await prisma.contributor.findFirst({
    where: sourceWhere,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      userId: true,
    },
  });
  if (!source) {
    return NextResponse.json({ error: 'Source contributor not found in your pool' }, { status: 404 });
  }

  // Idempotent: if an EmberContributor row already exists for (pool, image), return it.
  const existing = await prisma.emberContributor.findUnique({
    where: {
      contributorId_imageId: {
        contributorId: source.id,
        imageId,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, contributorId: existing.id, alreadyOnEmber: true });
  }

  const created = await prisma.emberContributor.create({
    data: {
      contributorId: source.id,
      imageId,
      // inviteSent stays false — they haven't been re-invited specifically for this ember yet.
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, contributorId: created.id, alreadyOnEmber: false });
}
