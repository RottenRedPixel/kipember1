import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, normalizePhone, requireApiUser } from '@/lib/auth-server';
import {
  ensureContributorRemovalAccess,
  ensureImageOwnerAccess,
} from '@/lib/ember-access';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageId, phoneNumber, email, name, userId } = await request.json();

    if (!imageId || typeof imageId !== 'string') {
      return NextResponse.json({ error: 'imageId is required' }, { status: 400 });
    }

    const image = await ensureImageOwnerAccess(auth.user.id, imageId);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    let linkedUser:
      | {
          id: string;
          name: string | null;
          email: string;
          phoneNumber: string | null;
        }
      | null = null;

    if (typeof userId === 'string' && userId) {
      linkedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
        },
      });

      if (!linkedUser) {
        return NextResponse.json({ error: 'Friend not found' }, { status: 404 });
      }
    }

    const normalizedPhone = normalizePhone(linkedUser?.phoneNumber || phoneNumber);
    const normalizedEmail = linkedUser?.email || (typeof email === 'string' && email.trim() ? normalizeEmail(email) : null);
    const contributorName =
      linkedUser?.name || (typeof name === 'string' && name.trim() ? name.trim() : null);

    if (!normalizedPhone && !normalizedEmail && !linkedUser) {
      return NextResponse.json(
        { error: 'Provide a phone number, email, or select a friend' },
        { status: 400 }
      );
    }

    const existing = await prisma.contributor.findFirst({
      where: {
        imageId,
        OR: [
          ...(linkedUser ? [{ userId: linkedUser.id }] : []),
          ...(normalizedPhone ? [{ phoneNumber: normalizedPhone }] : []),
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'That contributor is already attached to this Ember' },
        { status: 400 }
      );
    }

    const contributor = await prisma.contributor.create({
      data: {
        imageId,
        userId: linkedUser?.id || null,
        phoneNumber: normalizedPhone,
        email: normalizedEmail,
        name: contributorName,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
        emberSession: true,
      },
    });

    return NextResponse.json(contributor);
  } catch (error) {
    console.error('Error adding contributor:', error);
    return NextResponse.json(
      { error: 'Failed to add contributor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Contributor ID is required' },
        { status: 400 }
      );
    }

    const removalAccess = await ensureContributorRemovalAccess(auth.user.id, id);

    if (!removalAccess) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const { contributor, removalMode } = removalAccess;

    if (contributor.userId && contributor.userId === contributor.image.ownerId) {
      return NextResponse.json(
        { error: 'The Ember creator is automatically kept as a contributor' },
        { status: 400 }
      );
    }

    await prisma.contributor.delete({
      where: { id: contributor.id },
    });

    return NextResponse.json({
      success: true,
      removalMode,
    });
  } catch (error) {
    console.error('Error deleting contributor:', error);
    return NextResponse.json(
      { error: 'Failed to delete contributor' },
      { status: 500 }
    );
  }
}
