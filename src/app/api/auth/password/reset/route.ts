import { NextRequest, NextResponse } from 'next/server';
import {
  applyUserSessionCookie,
  claimMemoriesForUser,
  createUserSession,
  hashPassword,
} from '@/lib/auth-server';
import { consumePasswordResetChallenge } from '@/lib/auth-challenges';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Reset token and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const challenge = await consumePasswordResetChallenge(token);
    if (!challenge || !challenge.userId) {
      return NextResponse.json(
        { error: 'This password reset link is invalid or has expired' },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: challenge.userId },
      data: {
        passwordHash: hashPassword(password),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
      },
    });

    await claimMemoriesForUser({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
    });

    const sessionToken = await createUserSession(user.id);
    const response = NextResponse.json({
      ok: true,
      user,
    });
    applyUserSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
