import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/auth-server';
import { getRequestBaseUrl } from '@/lib/app-url';
import { createPasswordResetChallenge, getPasswordResetTtlMinutes } from '@/lib/auth-challenges';
import { sendSMS } from '@/lib/twilio';
import { prisma } from '@/lib/db';

function formatPhone(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phoneNumber);
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
      select: { id: true, email: true },
    });

    if (user) {
      const token = await createPasswordResetChallenge({
        email: user.email,
        userId: user.id,
      });

      const baseUrl = getRequestBaseUrl(request).replace(/\/$/, '');
      const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
      const ttl = getPasswordResetTtlMinutes();
      const message = `Reset your Ember password: ${resetUrl} (expires in ${ttl} min)`;

      await sendSMS(formatPhone(normalizedPhone), message);
    }

    return NextResponse.json({
      ok: true,
      message: 'If that number is in Ember, a reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Failed to start password reset' },
      { status: 500 }
    );
  }
}
