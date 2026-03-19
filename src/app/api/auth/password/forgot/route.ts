import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail } from '@/lib/auth-server';
import { createPasswordResetChallenge, getPasswordResetTtlMinutes } from '@/lib/auth-challenges';
import { sendPasswordResetEmail } from '@/lib/auth-email';
import { prisma } from '@/lib/db';
import { isEmailConfigured } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: 'Email sending is not configured yet' },
        { status: 500 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    });

    if (user) {
      const token = await createPasswordResetChallenge({
        email: user.email,
        userId: user.id,
      });

      await sendPasswordResetEmail({
        email: user.email,
        token,
        ttlMinutes: getPasswordResetTtlMinutes(),
        baseUrl: request.nextUrl.origin,
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'If that email is in Ember, a reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Failed to start password reset' },
      { status: 500 }
    );
  }
}
