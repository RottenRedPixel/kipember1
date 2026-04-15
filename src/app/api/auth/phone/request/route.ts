import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/auth-server';
import { createPhoneSigninChallenge, getPhoneCodeTtlMinutes } from '@/lib/auth-challenges';
import { findUserByPhone } from '@/lib/auth-users';
import { sendSMS } from '@/lib/twilio';

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();
    const normalizedPhone = normalizePhone(phoneNumber);

    if (!normalizedPhone || normalizedPhone.length !== 10) {
      return NextResponse.json({ error: 'A valid US phone number is required' }, { status: 400 });
    }

    const existingUser = await findUserByPhone(normalizedPhone);
    const code = await createPhoneSigninChallenge({
      phoneNumber: normalizedPhone,
      userId: existingUser?.id || null,
    });

    await sendSMS(
      normalizedPhone,
      `Your Ember sign-in code is ${code}. It expires in ${getPhoneCodeTtlMinutes()} minutes.`
    );

    return NextResponse.json({
      ok: true,
      message: 'Check your phone for a sign-in code.',
    });
  } catch (error) {
    console.error('Phone sign-in request error:', error);
    return NextResponse.json(
      { error: 'Failed to send sign-in code' },
      { status: 500 }
    );
  }
}
