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

    // Find or create the anonymous share-link contributor for this image
    // (identified by having no userId, phoneNumber, or email)
    const existing = await prisma.contributor.findFirst({
      where: {
        imageId,
        userId: null,
        phoneNumber: null,
        email: null,
      },
      select: { token: true },
    });

    if (existing) {
      return NextResponse.json({ token: existing.token });
    }

    const contributor = await prisma.contributor.create({
      data: { imageId },
      select: { token: true },
    });

    return NextResponse.json({ token: contributor.token });
  } catch (error) {
    console.error('Error getting share token:', error);
    return NextResponse.json({ error: 'Failed to get share token' }, { status: 500 });
  }
}
