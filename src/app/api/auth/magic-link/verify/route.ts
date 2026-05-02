import { NextRequest, NextResponse } from 'next/server';
import {
  applyUserSessionCookie,
  claimMemoriesForUser,
  createUserSession,
} from '@/lib/auth-server';
import { consumeMagicLinkChallenge } from '@/lib/auth-challenges';
import { createUserAccount } from '@/lib/auth-users';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Magic link token is required' }, { status: 400 });
    }

    const challenge = await consumeMagicLinkChallenge(token);
    if (!challenge || !challenge.email) {
      return NextResponse.json(
        { error: 'This magic link is invalid or has expired' },
        { status: 400 }
      );
    }

    let user = challenge.userId
      ? await prisma.user.findUnique({
          where: { id: challenge.userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        })
      : null;

    if (!user) {
      user =
        (await prisma.user.findUnique({
          where: { email: challenge.email },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        })) ||
        (await createUserAccount({
          email: challenge.email,
          phoneNumber: challenge.phoneNumber || null,
          firstName: challenge.firstName || null,
          lastName: challenge.lastName || null,
        }));
    }

    await claimMemoriesForUser({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
    });

    const sessionToken = await createUserSession(user.id);
    const response = NextResponse.json({
      user,
    });
    applyUserSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    console.error('Magic link verify error:', error);
    return NextResponse.json(
      { error: 'Failed to verify magic link' },
      { status: 500 }
    );
  }
}
