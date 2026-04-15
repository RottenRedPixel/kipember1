import { NextRequest, NextResponse } from 'next/server';
import {
  applyUserSessionCookie,
  claimMemoriesForUser,
  createUserSession,
  normalizePhone,
} from '@/lib/auth-server';
import { consumePhoneSigninChallenge } from '@/lib/auth-challenges';
import { getOrCreatePhoneUser } from '@/lib/auth-users';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, code } = await request.json();
    const normalizedPhone = normalizePhone(phoneNumber);

    if (!normalizedPhone || normalizedPhone.length !== 10 || !code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Phone number and sign-in code are required' },
        { status: 400 }
      );
    }

    const challenge = await consumePhoneSigninChallenge({
      phoneNumber: normalizedPhone,
      code: code.trim(),
    });

    if (!challenge) {
      return NextResponse.json(
        { error: 'That sign-in code is invalid or has expired' },
        { status: 400 }
      );
    }

    let user = challenge.userId
      ? await prisma.user.findUnique({
          where: { id: challenge.userId },
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        })
      : null;

    if (!user) {
      user = await getOrCreatePhoneUser({
        phoneNumber: normalizedPhone,
      });
    }

    await claimMemoriesForUser({
      id: user.id,
      name: user.name,
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
    console.error('Phone sign-in verify error:', error);
    return NextResponse.json(
      { error: 'Failed to verify sign-in code' },
      { status: 500 }
    );
  }
}
