// Server-side magic-link landing. Used to be a client page that called
// /api/auth/magic-link/verify and rendered an "Opening Ember…" splash
// (with an "expired link" error path). Now it does the verification
// server-side and redirects — success → /home, anything else →
// /signin?expired=1. No visible page, no error UI to maintain.

import { redirect } from 'next/navigation';
import {
  claimMemoriesForUser,
  createUserSession,
  setUserSessionCookie,
} from '@/lib/auth-server';
import { consumeMagicLinkChallenge } from '@/lib/auth-challenges';
import { createUserAccount } from '@/lib/auth-users';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token: rawToken } = await searchParams;
  const token = typeof rawToken === 'string' ? rawToken : Array.isArray(rawToken) ? rawToken[0] : null;

  if (!token) {
    redirect('/signin?expired=1');
  }

  const challenge = await consumeMagicLinkChallenge(token);
  if (!challenge || !challenge.email) {
    redirect('/signin?expired=1');
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
  await setUserSessionCookie(sessionToken);
  redirect('/home');
}
