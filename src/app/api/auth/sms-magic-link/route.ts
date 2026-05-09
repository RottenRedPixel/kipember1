import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/auth-server';
import { createSmsSigninChallenge } from '@/lib/auth-challenges';
import { prisma } from '@/lib/db';
import { sendSMS } from '@/lib/sms';
import { getAppBaseUrl } from '@/lib/app-url';

const BASE_URL = getAppBaseUrl();

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, next } = await request.json();

    const normalized = normalizePhone(phoneNumber);
    if (!normalized) {
      return NextResponse.json({ error: 'A valid phone number is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber: normalized },
      select: { id: true, firstName: true },
    });

    // Silent success — don't reveal whether the phone is registered
    if (user) {
      const redirectPath = typeof next === 'string' && next.startsWith('/') ? next : '/home';
      const token = await createSmsSigninChallenge({ userId: user.id, redirectPath });
      const link = `${BASE_URL}/m/${token}`;
      const name = user.firstName || 'there';
      await sendSMS(normalized, `Hi ${name}, here's your Ember sign-in link: ${link}`).catch((err) => {
        console.error('SMS magic link send failed:', err);
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('SMS magic link error:', error);
    return NextResponse.json({ error: 'Failed to send sign-in link' }, { status: 500 });
  }
}
