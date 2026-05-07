import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, normalizePhone, requireApiUser } from '@/lib/auth-server';
import { ensureContributorRemovalAccess, ensureEmberOwnerAccess } from '@/lib/ember';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { imageId, phoneNumber, email, name, firstName, lastName } = await request.json();

    const hasImageId = typeof imageId === 'string' && imageId.length > 0;
    let image: { ownerId: string } | null = null;
    if (hasImageId) {
      image = await ensureEmberOwnerAccess(auth.user.id, imageId);
      if (!image) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const normalizedPhone = normalizePhone(phoneNumber);
    const normalizedEmail = typeof email === 'string' && email.trim() ? normalizeEmail(email) : null;

    // Resolve display name: prefer firstName+lastName, fall back to name field
    const resolvedFirstName = typeof firstName === 'string' && firstName.trim() ? firstName.trim() : null;
    const resolvedLastName = typeof lastName === 'string' && lastName.trim() ? lastName.trim() : null;
    const resolvedName = typeof name === 'string' && name.trim() ? name.trim() : null;
    const displayFirst = resolvedFirstName ?? (resolvedName ? resolvedName.split(' ')[0] : null);

    if (!displayFirst) {
      return NextResponse.json({ error: 'First name is required.' }, { status: 400 });
    }
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 });
    }

    // Find or create the User by phone (primary identity).
    let user = await prisma.user.findUnique({ where: { phoneNumber: normalizedPhone } });
    if (user) {
      // Refresh name/email if we have new data.
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: resolvedFirstName ?? user.firstName,
          lastName: resolvedLastName ?? user.lastName ?? (resolvedName ? resolvedName.split(' ').slice(1).join(' ') || null : null),
          email: normalizedEmail ?? user.email,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          phoneNumber: normalizedPhone,
          email: normalizedEmail,
          firstName: displayFirst,
          lastName: resolvedLastName ?? (resolvedName ? resolvedName.split(' ').slice(1).join(' ') || null : null),
        },
      });
    }

    if (!hasImageId) {
      // Track the pool relationship so the owner can see this person
      // in their contributors list even before attaching to an ember.
      await prisma.contributorPool.upsert({
        where: { ownerId_userId: { ownerId: auth.user.id, userId: user.id } },
        create: { ownerId: auth.user.id, userId: user.id },
        update: {},
      });
      return NextResponse.json({
        id: null,
        imageId: null,
        token: null,
        inviteSent: false,
        createdAt: user.createdAt,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        userId: user.id,
        emberSession: null,
      });
    }

    // Check if already attached to this ember.
    const existing = await prisma.emberContributor.findUnique({
      where: { userId_imageId: { userId: user.id, imageId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'That contributor is already attached to this Ember' },
        { status: 400 }
      );
    }

    const emberContributor = await prisma.emberContributor.create({
      data: { userId: user.id, imageId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
        },
        emberSession: true,
      },
    });

    return NextResponse.json({
      id: emberContributor.id,
      imageId: emberContributor.imageId,
      token: emberContributor.token,
      inviteSent: emberContributor.inviteSent,
      createdAt: emberContributor.createdAt,
      firstName: emberContributor.user.firstName,
      lastName: emberContributor.user.lastName,
      email: emberContributor.user.email,
      phoneNumber: emberContributor.user.phoneNumber,
      userId: emberContributor.user.id,
      user: emberContributor.user,
      emberSession: emberContributor.emberSession,
    });
  } catch (error) {
    console.error('Error adding contributor:', error);
    return NextResponse.json({ error: 'Failed to add contributor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Contributor ID is required' }, { status: 400 });

    const removalAccess = await ensureContributorRemovalAccess(auth.user.id, id);
    if (!removalAccess) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const { contributor: emberContributor, removalMode } = removalAccess;

    if (emberContributor.userId === emberContributor.image.ownerId) {
      return NextResponse.json(
        { error: 'The Ember creator is automatically kept as a contributor' },
        { status: 400 }
      );
    }

    await prisma.emberContributor.delete({ where: { id: emberContributor.id } });
    return NextResponse.json({ success: true, removalMode });
  } catch (error) {
    console.error('Error deleting contributor:', error);
    return NextResponse.json({ error: 'Failed to delete contributor' }, { status: 500 });
  }
}
