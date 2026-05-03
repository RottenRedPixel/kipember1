import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, normalizePhone, requireApiUser } from '@/lib/auth-server';
import {
  ensureContributorRemovalAccess,
  ensureEmberOwnerAccess,
} from '@/lib/ember';
import { prisma } from '@/lib/db';
import { getUserDisplayName } from '@/lib/user-name';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageId, phoneNumber, email, name, userId } = await request.json();

    // imageId is optional now: when present, we create the pool entry AND
    // attach it to that ember; when omitted, we create a pool-only entry
    // (used by the /account contributors view to grow the owner's pool
    // without picking an ember yet).
    const hasImageId = typeof imageId === 'string' && imageId.length > 0;
    let image: { ownerId: string } | null = null;
    if (hasImageId) {
      image = await ensureEmberOwnerAccess(auth.user.id, imageId);
      if (!image) {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      }
    }
    const ownerId = image?.ownerId ?? auth.user.id;

    let linkedUser:
      | {
          id: string;
          firstName: string | null;
          lastName: string | null;
          email: string;
          phoneNumber: string | null;
        }
      | null = null;

    if (typeof userId === 'string' && userId) {
      linkedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
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
      getUserDisplayName(linkedUser) || (typeof name === 'string' && name.trim() ? name.trim() : null);

    if (!normalizedPhone && !normalizedEmail && !linkedUser && !contributorName) {
      return NextResponse.json(
        { error: 'Provide a name, phone number, email, or select a friend' },
        { status: 400 }
      );
    }

    // Find or create the pool Contributor for this owner.
    let poolContributor = await prisma.contributor.findFirst({
      where: {
        ownerId,
        OR: [
          ...(linkedUser ? [{ userId: linkedUser.id }] : []),
          ...(normalizedPhone ? [{ phoneNumber: normalizedPhone }] : []),
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ],
      },
    });

    if (poolContributor) {
      // Refresh display fields if we have new ones.
      poolContributor = await prisma.contributor.update({
        where: { id: poolContributor.id },
        data: {
          name: contributorName ?? poolContributor.name,
          email: normalizedEmail ?? poolContributor.email,
          phoneNumber: normalizedPhone ?? poolContributor.phoneNumber,
          userId: linkedUser?.id ?? poolContributor.userId,
        },
      });
    } else {
      poolContributor = await prisma.contributor.create({
        data: {
          ownerId,
          userId: linkedUser?.id || null,
          phoneNumber: normalizedPhone,
          email: normalizedEmail,
          name: contributorName,
        },
      });
    }

    // Pool-only path: no ember to attach to. Return the bare pool fields.
    if (!hasImageId) {
      return NextResponse.json({
        id: null,
        imageId: null,
        token: null,
        inviteSent: false,
        createdAt: poolContributor.createdAt,
        name: poolContributor.name,
        email: poolContributor.email,
        phoneNumber: poolContributor.phoneNumber,
        userId: poolContributor.userId,
        user: null,
        emberSession: null,
        poolContributorId: poolContributor.id,
      });
    }

    // Check if they're already attached to this ember.
    const existing = await prisma.emberContributor.findUnique({
      where: {
        contributorId_imageId: {
          contributorId: poolContributor.id,
          imageId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'That contributor is already attached to this Ember' },
        { status: 400 }
      );
    }

    const emberContributor = await prisma.emberContributor.create({
      data: {
        contributorId: poolContributor.id,
        imageId,
      },
      include: {
        contributor: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
        emberSession: true,
      },
    });

    // Maintain the legacy response shape: contributor fields hoisted to top
    // level so existing callers don't break.
    return NextResponse.json({
      id: emberContributor.id,
      imageId: emberContributor.imageId,
      token: emberContributor.token,
      inviteSent: emberContributor.inviteSent,
      createdAt: emberContributor.createdAt,
      name: emberContributor.contributor.name,
      email: emberContributor.contributor.email,
      phoneNumber: emberContributor.contributor.phoneNumber,
      userId: emberContributor.contributor.userId,
      user: emberContributor.contributor.user,
      emberSession: emberContributor.emberSession,
    });
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

    const { contributor: emberContributor, removalMode } = removalAccess;

    if (
      emberContributor.contributor.userId &&
      emberContributor.contributor.userId === emberContributor.image.ownerId
    ) {
      return NextResponse.json(
        { error: 'The Ember creator is automatically kept as a contributor' },
        { status: 400 }
      );
    }

    await prisma.emberContributor.delete({
      where: { id: emberContributor.id },
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
