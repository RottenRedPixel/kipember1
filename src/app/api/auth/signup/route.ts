import { NextRequest, NextResponse } from 'next/server';
import {
  getPhoneAccountEmail,
  hashPassword,
  normalizeEmail,
  normalizePhone,
} from '@/lib/auth-server';
import {
  createMagicLinkChallenge,
  createPhoneSigninChallenge,
  getMagicLinkTtlMinutes,
  getPhoneCodeTtlMinutes,
} from '@/lib/auth-challenges';
import { sendMagicLinkEmail } from '@/lib/auth-email';
import { findUserByEmail, findUserByPhone } from '@/lib/auth-users';
import { getRequestBaseUrl } from '@/lib/app-url';
import { isEmailConfigured } from '@/lib/email';
import { sendSMS } from '@/lib/twilio';

export async function POST(request: NextRequest) {
  try {
    const { firstName, lastName, email, phoneNumber, password } = await request.json();

    if (!phoneNumber || typeof phoneNumber !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Phone number and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
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

    const providedEmail = typeof email === 'string' && email.trim() ? normalizeEmail(email) : null;
    const firstNameValue = typeof firstName === 'string' && firstName.trim() ? firstName.trim() : null;
    const lastNameValue = typeof lastName === 'string' && lastName.trim() ? lastName.trim() : null;
    const passwordHash = hashPassword(password);

    const existingByPhone = await findUserByPhone(normalizedPhone);
    if (existingByPhone) {
      return NextResponse.json(
        { error: 'An account with that phone number already exists' },
        { status: 400 }
      );
    }

    if (providedEmail) {
      if (!isEmailConfigured()) {
        return NextResponse.json(
          { error: 'Email sending is not configured yet' },
          { status: 500 }
        );
      }

      const existingByEmail = await findUserByEmail(providedEmail);
      if (existingByEmail) {
        return NextResponse.json(
          { error: 'An account with that email already exists' },
          { status: 400 }
        );
      }

      const token = await createMagicLinkChallenge({
        email: providedEmail,
        phoneNumber: normalizedPhone,
        firstName: firstNameValue,
        lastName: lastNameValue,
        userId: null,
        mode: 'signup',
        passwordHash,
      });

      await sendMagicLinkEmail({
        email: providedEmail,
        token,
        mode: 'signup',
        ttlMinutes: getMagicLinkTtlMinutes(),
        baseUrl: getRequestBaseUrl(request),
      });

      return NextResponse.json({
        confirmationRequired: true,
        confirmationType: 'email',
        email: providedEmail,
      });
    }

    const code = await createPhoneSigninChallenge({
      phoneNumber: normalizedPhone,
      userId: null,
      firstName: firstNameValue,
      lastName: lastNameValue,
      passwordHash,
    });

    await sendSMS(
      normalizedPhone,
      `Your Ember signup code is ${code}. It expires in ${getPhoneCodeTtlMinutes()} minutes.`
    );

    return NextResponse.json({
      confirmationRequired: true,
      confirmationType: 'sms',
      phoneNumber: normalizedPhone,
      email: getPhoneAccountEmail(normalizedPhone),
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
