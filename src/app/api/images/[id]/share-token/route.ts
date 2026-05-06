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

    // Look for an existing anonymous (share-link) EC on this ember:
    // an EC whose linked User has all identity fields null.
    const existingEmberContributor = await prisma.emberContributor.findFirst({
      where: {
        imageId,
        user: {
          firstName: null,
          lastName: null,
          email: null,
          phoneNumber: null,
        },
      },
      select: { token: true },
    });

    if (existingEmberContributor) {
      return NextResponse.json({ token: existingEmberContributor.token });
    }

    // No share-link EC for this ember yet. Create an anonymous User shell
    // (all identity fields null) and attach it as an EmberContributor.
    const anonymousUser = await prisma.user.create({
      data: {
        // All identity fields intentionally null — marks this as a
        // share-link placeholder, not a real person.
        firstName: null,
        lastName: null,
        email: null,
        phoneNumber: null,
      },
      select: { id: true },
    });

    const created = await prisma.emberContributor.create({
      data: {
        imageId,
        userId: anonymousUser.id,
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
