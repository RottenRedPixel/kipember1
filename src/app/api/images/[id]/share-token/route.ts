import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess } from '@/lib/ember';
import { prisma } from '@/lib/db';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: imageId } = await params;

    const image = await ensureEmberOwnerAccess(auth.user.id, imageId);
    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    // Find or create the anonymous share-link pool entry for this owner
    // (identified by having no userId, phoneNumber, or email — share-link
    // placeholders are owned by the image owner). The same anonymous pool
    // entry is reused per ember via its EmberContributor join row.
    const existingEmberContributor = await prisma.emberContributor.findFirst({
      where: {
        imageId,
        contributor: {
          ownerId: image.ownerId,
          userId: null,
          phoneNumber: null,
          email: null,
        },
      },
      select: { token: true },
    });

    if (existingEmberContributor) {
      return NextResponse.json({ token: existingEmberContributor.token });
    }

    // No share-link EC for this ember yet. Find or create the anonymous pool
    // entry first, then attach.
    let anonymousPool = await prisma.contributor.findFirst({
      where: {
        ownerId: image.ownerId,
        userId: null,
        phoneNumber: null,
        email: null,
        name: null,
      },
      select: { id: true },
    });
    if (!anonymousPool) {
      anonymousPool = await prisma.contributor.create({
        data: { ownerId: image.ownerId },
        select: { id: true },
      });
    }

    const created = await prisma.emberContributor.create({
      data: {
        imageId,
        contributorId: anonymousPool.id,
        tokenCreatedAt: new Date(),
        tokenCreatedByUserId: auth.user.id,
      },
      select: { token: true },
    });

    return NextResponse.json({ token: created.token });
  } catch (error) {
    console.error('Error getting share token:', error);
    return NextResponse.json({ error: 'Failed to get share token' }, { status: 500 });
  }
}
