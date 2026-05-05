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
    select: { avatarFilename: true, createdAt: true },
  });

  return NextResponse.json({
    user: {
      id: auth.user.id,
      firstName: auth.user.firstName,
      lastName: auth.user.lastName,
      email: auth.user.email,
      phoneNumber: auth.user.phoneNumber,
      avatarUrl: userRecord?.avatarFilename ? `/api/uploads/${userRecord.avatarFilename}` : null,
      createdAt: userRecord?.createdAt?.toISOString() ?? null,
    },
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { firstName, lastName, email, phoneNumber } = await request.json();

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
        firstName: typeof firstName === 'string' && firstName.trim() ? firstName.trim() : null,
        lastName: typeof lastName === 'string' && lastName.trim() ? lastName.trim() : null,
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        avatarFilename: true,
      },
    });

    await claimMemoriesForUser({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
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
