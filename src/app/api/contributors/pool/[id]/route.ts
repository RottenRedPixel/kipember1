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

    const { id: poolId } = await params;

    const contributor = await prisma.contributor.findUnique({
      where: { id: poolId },
      select: { id: true, ownerId: true, name: true, phoneNumber: true, email: true },
    });

    if (!contributor || contributor.ownerId !== auth.user.id) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await request.json();
    const name =
      typeof body?.name === 'string' ? body.name.trim() || null : contributor.name;
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

    const conflict = await prisma.contributor.findFirst({
      where: {
        ownerId: auth.user.id,
        id: { not: poolId },
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

    await prisma.contributor.update({
      where: { id: poolId },
      data: { name, phoneNumber, email },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating pool contributor:', error);
    return NextResponse.json({ error: 'Failed to update contributor' }, { status: 500 });
  }
}
