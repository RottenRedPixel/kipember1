import { NextRequest, NextResponse } from 'next/server';
import {
  claimMemoriesForUser,
  normalizeEmail,
  normalizePhone,
  requireApiUser,
} from '@/lib/auth-server';
import { prisma } from '@/lib/db';

export async function GET() {
  const auth = await requireApiUser();

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { avatarFilename: true },
  });

  return NextResponse.json({
    user: {
      id: auth.user.id,
      name: auth.user.name,
      email: auth.user.email,
      phoneNumber: auth.user.phoneNumber,
      avatarUrl: userRecord?.avatarFilename ? `/api/uploads/${userRecord.avatarFilename}` : null,
    },
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, email, phoneNumber } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phoneNumber);

    const existingUser = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        id: { not: auth.user.id },
      },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'That email is already in use' },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        name: typeof name === 'string' && name.trim() ? name.trim() : null,
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        avatarFilename: true,
      },
    });

    await claimMemoriesForUser({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        avatarUrl: user.avatarFilename ? `/api/uploads/${user.avatarFilename}` : null,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
