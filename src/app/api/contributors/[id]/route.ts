import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, normalizePhone, requireApiUser } from '@/lib/auth-server';
import { ensureOwnedContributorAccess } from '@/lib/ember';
import { prisma } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const emberContributor = await ensureOwnedContributorAccess(auth.user.id, id);

    if (!emberContributor) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const user = emberContributor.user ?? null;
    const body = await request.json();

    // Map legacy `name` field to firstName/lastName split, or accept firstName/lastName directly
    let firstName: string | null = user?.firstName ?? null;
    let lastName: string | null = user?.lastName ?? null;
    if (typeof body?.firstName === 'string') {
      firstName = body.firstName.trim() || null;
    } else if (typeof body?.name === 'string') {
      // Legacy: split "First Last" into firstName/lastName
      const parts = body.name.trim().split(/\s+/);
      firstName = parts[0] || null;
      lastName = parts.slice(1).join(' ') || null;
    } else if (body?.name === null) {
      firstName = null;
      lastName = null;
    }
    if (typeof body?.lastName === 'string') {
      lastName = body.lastName.trim() || null;
    }

    const phoneNumber =
      body?.phoneNumber === null
        ? null
        : typeof body?.phoneNumber === 'string'
        ? normalizePhone(body.phoneNumber)
        : user?.phoneNumber ?? null;
    const email =
      body?.email === null
        ? null
        : typeof body?.email === 'string'
        ? normalizeEmail(body.email)
        : user?.email ?? null;

    if (!phoneNumber && !email) {
      return NextResponse.json(
        { error: 'Provide a phone number or email' },
        { status: 400 }
      );
    }

    // Within the owner's embers, identity (phone/email) must remain unique across users.
    const existing = await prisma.user.findFirst({
      where: {
        id: { not: emberContributor.userId },
        OR: [
          ...(phoneNumber ? [{ phoneNumber }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'That contributor is already in your pool' },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: emberContributor.userId },
      data: {
        firstName,
        lastName,
        phoneNumber,
        email,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
      },
    });

    const refreshed = await prisma.emberContributor.findUnique({
      where: { id: emberContributor.id },
      include: {
        emberSession: {
          select: {
            status: true,
            currentStep: true,
          },
        },
        voiceCalls: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            startedAt: true,
            endedAt: true,
            createdAt: true,
            callSummary: true,
            initiatedBy: true,
          },
        },
      },
    });

    const displayName = [updatedUser.firstName, updatedUser.lastName].filter(Boolean).join(' ');

    return NextResponse.json({
      id: emberContributor.id,
      imageId: emberContributor.imageId,
      token: emberContributor.token,
      inviteSent: emberContributor.inviteSent,
      name: displayName || null,
      email: updatedUser.email,
      phoneNumber: updatedUser.phoneNumber,
      userId: updatedUser.id,
      user: updatedUser,
      emberSession: refreshed?.emberSession ?? null,
      voiceCalls: refreshed?.voiceCalls ?? [],
    });
  } catch (error) {
    console.error('Error updating contributor:', error);
    return NextResponse.json(
      { error: 'Failed to update contributor' },
      { status: 500 }
    );
  }
}
