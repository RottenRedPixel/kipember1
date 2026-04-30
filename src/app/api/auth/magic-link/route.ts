import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, normalizePhone } from '@/lib/auth-server';
import { createMagicLinkChallenge, getMagicLinkTtlMinutes, type MagicLinkMode } from '@/lib/auth-challenges';
import { sendMagicLinkEmail } from '@/lib/auth-email';
import { findUserByEmail } from '@/lib/auth-users';
import { getRequestBaseUrl } from '@/lib/app-url';
import { isEmailConfigured } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email, firstName, lastName, phoneNumber, mode } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (mode !== 'login' && mode !== 'signup') {
      return NextResponse.json({ error: 'A valid magic link mode is required' }, { status: 400 });
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: 'Email sending is not configured yet' },
        { status: 500 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phoneNumber);
    const existingUser = await findUserByEmail(normalizedEmail);

    if (mode === 'login' && !existingUser) {
      return NextResponse.json(
        { error: 'No Ember account was found with that email' },
        { status: 404 }
      );
    }

    if (mode === 'signup' && existingUser) {
      return NextResponse.json(
        { error: 'An account with that email already exists' },
        { status: 400 }
      );
    }

    const token = await createMagicLinkChallenge({
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      firstName: typeof firstName === 'string' && firstName.trim() ? firstName.trim() : null,
      lastName: typeof lastName === 'string' && lastName.trim() ? lastName.trim() : null,
      userId: existingUser?.id || null,
      mode: mode as MagicLinkMode,
    });

    await sendMagicLinkEmail({
      email: normalizedEmail,
      token,
      mode: mode as MagicLinkMode,
      ttlMinutes: getMagicLinkTtlMinutes(),
      baseUrl: getRequestBaseUrl(request),
    });

    return NextResponse.json({
      ok: true,
      message:
        mode === 'signup'
          ? 'Check your email to finish creating your Ember account.'
          : 'Check your email for your Ember sign-in link.',
    });
  } catch (error) {
    console.error('Magic link request error:', error);
    return NextResponse.json(
      { error: 'Failed to send magic link' },
      { status: 500 }
    );
  }
}
