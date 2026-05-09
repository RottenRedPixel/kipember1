import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { prisma } from '@/lib/db';

/**
 * POST /api/contributors/add-existing
 *
 * Body: { emberId: string, sourceKey: string }
 *
 * Adds a person from the owner's contributor pool to another ember they own.
 * `sourceKey` is the UnifiedContributor.key, which equals the User.id.
 * Idempotent: returns ok if the row already exists.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { emberId?: unknown; sourceKey?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const emberId = typeof body.emberId === 'string' ? body.emberId : '';
  const sourceKey = typeof body.sourceKey === 'string' ? body.sourceKey : '';
  if (!emberId || !sourceKey) {
    return NextResponse.json({ error: 'emberId and sourceKey are required' }, { status: 400 });
  }

  // Confirm the user owns the target ember.
  const ember = await prisma.ember.findUnique({ where: { id: emberId }, select: { ownerId: true } });
  if (!ember || ember.ownerId !== auth.user.id) {
    return NextResponse.json({ error: 'Ember not found' }, { status: 404 });
  }

  // sourceKey === userId in the new model.
  const targetUserId = sourceKey;
  const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: 'Contributor not found' }, { status: 404 });
  }

  const existing = await prisma.emberContributor.findUnique({
    where: { userId_emberId: { userId: targetUserId, emberId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, contributorId: existing.id, alreadyOnEmber: true });
  }

  const created = await prisma.emberContributor.create({
    data: { userId: targetUserId, emberId },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, contributorId: created.id, alreadyOnEmber: false });
}
