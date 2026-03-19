import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { claimGuestMemoriesForUser } from '@/lib/guest-embers';

const SESSION_COOKIE_NAME = 'ember_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const LEGACY_OWNER_USER_ID = 'legacy_owner_march_2026';
export const PRIMARY_OWNER_EMAIL = 'sethtropper@gmail.com';
export const PHONE_ACCOUNT_EMAIL_DOMAIN = 'phone.ember.local';

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  return digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;
}

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function hashAuthSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, derivedKey] = storedHash.split(':');
  if (!salt || !derivedKey) {
    return false;
  }

  const computed = scryptSync(password, salt, 64);
  const expected = Buffer.from(derivedKey, 'hex');

  if (computed.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(computed, expected);
}

export function createTemporaryPasswordHash(): string {
  return hashPassword(randomBytes(24).toString('hex'));
}

export function getPhoneAccountEmail(phoneNumber: string): string {
  return `phone-${phoneNumber}@${PHONE_ACCOUNT_EMAIL_DOMAIN}`;
}

export function isPhoneAccountEmail(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.toLowerCase().endsWith(`@${PHONE_ACCOUNT_EMAIL_DOMAIN}`);
}

export async function transferLegacyOwnerImagesIfNeeded(user: {
  id: string;
  email: string;
}) {
  if (normalizeEmail(user.email) !== PRIMARY_OWNER_EMAIL) {
    return;
  }

  await prisma.image.updateMany({
    where: { ownerId: LEGACY_OWNER_USER_ID },
    data: { ownerId: user.id },
  });
}

async function syncContributorLinksForUser(user: {
  id: string;
  email: string;
  phoneNumber: string | null;
  name: string | null;
}) {
  const orFilters: Array<Record<string, string>> = [{ email: user.email }];

  if (user.phoneNumber) {
    orFilters.push({ phoneNumber: user.phoneNumber });
  }

  await prisma.contributor.updateMany({
    where: {
      userId: null,
      OR: orFilters,
    },
    data: {
      userId: user.id,
      name: user.name || null,
      email: user.email,
      phoneNumber: user.phoneNumber,
    },
  });
}

export async function claimMemoriesForUser(user: {
  id: string;
  email: string;
  phoneNumber: string | null;
  name: string | null;
}) {
  await syncContributorLinksForUser(user);

  await claimGuestMemoriesForUser({
    userId: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    name: user.name,
  });
}

export async function createUserSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
    },
  });

  return token;
}

export function applyUserSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
}

export function clearUserSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
}

export async function getCurrentAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.userSession.delete({
      where: { id: session.id },
    }).catch(() => undefined);

    return null;
  }

  await claimMemoriesForUser({
    id: session.user.id,
    email: session.user.email,
    phoneNumber: session.user.phoneNumber,
    name: session.user.name,
  });

  return {
    session,
    user: session.user,
  };
}

export async function requireApiUser() {
  return getCurrentAuth();
}

export async function requirePageUser() {
  const auth = await getCurrentAuth();
  if (!auth) {
    redirect('/login');
  }

  return auth.user;
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return;
  }

  await prisma.userSession.deleteMany({
    where: { tokenHash: hashSessionToken(token) },
  });
}
