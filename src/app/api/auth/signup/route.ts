import { NextRequest, NextResponse } from 'next/server';
import {
  applyUserSessionCookie,
  claimMemoriesForUser,
  createUserSession,
  hashPassword,
  normalizeEmail,
  normalizePhone,
} from '@/lib/auth-server';
import { createUserAccount, findUserByEmail } from '@/lib/auth-users';

export async function POST(request: NextRequest) {
  try {
    const { firstName, lastName, email, phoneNumber, password } = await request.json();

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phoneNumber);

    const existingUser = await findUserByEmail(normalizedEmail);

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with that email already exists' },
        { status: 400 }
      );
    }

    const user = await createUserAccount({
      firstName: typeof firstName === 'string' && firstName.trim() ? firstName.trim() : null,
      lastName: typeof lastName === 'string' && lastName.trim() ? lastName.trim() : null,
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      passwordHash: hashPassword(password),
    });

    await claimMemoriesForUser({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
    });

    const token = await createUserSession(user.id);
    const response = NextResponse.json({ user });
    applyUserSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
