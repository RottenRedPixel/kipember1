import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  applyUserSessionCookie,
  claimMemoriesForUser,
  createUserSession,
  normalizePhone,
  verifyPassword,
} from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, password } = await request.json();

    if (!phoneNumber || typeof phoneNumber !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Phone number and password are required' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phoneNumber);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: 'Invalid phone number or password' },
        { status: 401 }
      );
    }

    await claimMemoriesForUser({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
    });

    const token = await createUserSession(user.id);
    const response = NextResponse.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
      },
    });

    applyUserSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Failed to log in' },
      { status: 500 }
    );
  }
}
