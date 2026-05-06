import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, normalizePhone, requireApiUser } from '@/lib/auth-server';
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

    const { id: userId } = await params;

    // Verify that this user is actually a contributor on at least one ember
    // owned by the caller (i.e., the owner is managing their contributor's profile).
    const isContributorOnOwnersEmber = await prisma.emberContributor.findFirst({
      where: {
        userId,
        image: { ownerId: auth.user.id },
      },
      select: { id: true },
    });

    if (!isContributorOnOwnersEmber) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const contributor = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, phoneNumber: true, email: true },
    });

    if (!contributor) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await request.json();

    // Support legacy `name` field (split into firstName/lastName) or direct fields
    let firstName: string | null = contributor.firstName;
    let lastName: string | null = contributor.lastName;
    if (typeof body?.firstName === 'string') {
      firstName = body.firstName.trim() || null;
    } else if (typeof body?.name === 'string') {
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
      typeof body?.phoneNumber === 'string'
        ? normalizePhone(body.phoneNumber)
        : contributor.phoneNumber;
    const email =
      typeof body?.email === 'string'
        ? normalizeEmail(body.email)
        : contributor.email;

    if (!phoneNumber && !email) {
      return NextResponse.json(
        { error: 'Provide a phone number or email' },
        { status: 400 }
      );
    }

    const conflict = await prisma.user.findFirst({
      where: {
        id: { not: userId },
        OR: [
          ...(phoneNumber ? [{ phoneNumber }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    });
    if (conflict) {
      return NextResponse.json(
        { error: 'That contributor is already in your pool' },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { firstName, lastName, phoneNumber, email },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating pool contributor:', error);
    return NextResponse.json({ error: 'Failed to update contributor' }, { status: 500 });
  }
}
