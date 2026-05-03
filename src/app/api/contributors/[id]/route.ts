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

    const pool = emberContributor.contributor;
    const body = await request.json();
    const name =
      body?.name === null
        ? null
        : typeof body?.name === 'string'
        ? body.name.trim() || null
        : pool.name;
    const phoneNumber =
      body?.phoneNumber === null
        ? null
        : typeof body?.phoneNumber === 'string'
        ? normalizePhone(body.phoneNumber)
        : pool.phoneNumber;
    const email =
      body?.email === null
        ? null
        : typeof body?.email === 'string'
        ? normalizeEmail(body.email)
        : pool.email;

    if (!phoneNumber && !email) {
      return NextResponse.json(
        { error: 'Provide a phone number or email' },
        { status: 400 }
      );
    }

    // Within the owner's pool, identity (phone/email) must remain unique.
    const existing = await prisma.contributor.findFirst({
      where: {
        ownerId: pool.ownerId,
        id: { not: pool.id },
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

    const updatedPool = await prisma.contributor.update({
      where: { id: pool.id },
      data: {
        name,
        phoneNumber,
        email,
      },
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

    return NextResponse.json({
      id: emberContributor.id,
      imageId: emberContributor.imageId,
      token: emberContributor.token,
      inviteSent: emberContributor.inviteSent,
      name: updatedPool.name,
      email: updatedPool.email,
      phoneNumber: updatedPool.phoneNumber,
      userId: updatedPool.userId,
      user: updatedPool.user,
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
