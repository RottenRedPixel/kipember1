import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  LEGACY_OWNER_USER_ID,
  PRIMARY_OWNER_EMAIL,
  applyUserSessionCookie,
  claimMemoriesForUser,
  createUserSession,
  hashPassword,
  normalizeEmail,
  normalizePhone,
} from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    const { name, email, phoneNumber, password } = await request.json();

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phoneNumber);

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with that email already exists' },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name: typeof name === 'string' && name.trim() ? name.trim() : null,
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        passwordHash: hashPassword(password),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
      },
    });

    if (normalizedEmail === PRIMARY_OWNER_EMAIL) {
      await prisma.image.updateMany({
        where: { ownerId: LEGACY_OWNER_USER_ID },
        data: { ownerId: user.id },
      });
    }

    await claimMemoriesForUser({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
    });

    const token = await createUserSession(user.id);
    const response = NextResponse.json({ user });
    applyUserSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
