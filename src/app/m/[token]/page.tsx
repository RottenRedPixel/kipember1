import { redirect } from 'next/navigation';
import { claimMemoriesForUser, createUserSession, setUserSessionCookie } from '@/lib/auth-server';
import { consumeSmsSigninChallenge } from '@/lib/auth-challenges';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function SmsSigninPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let challenge: { userId: string | null; redirectPath: string } | null = null;
  try {
    challenge = await consumeSmsSigninChallenge(token);
  } catch (err) {
    console.error('[/m] consumeSmsSigninChallenge error:', err);
    redirect('/');
  }

  const userId = challenge?.userId;
  if (!userId) {
    console.error('[/m] no userId in challenge, token:', token);
    redirect('/');
  }

  let user: { id: string; firstName: string | null; lastName: string | null; email: string | null; phoneNumber: string | null } | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
    });
  } catch (err) {
    console.error('[/m] user lookup error:', err);
    redirect('/');
  }

  if (!user) {
    console.error('[/m] user not found for userId:', userId);
    redirect('/');
  }

  try {
    await claimMemoriesForUser(user);
    const sessionToken = await createUserSession(user.id);
    await setUserSessionCookie(sessionToken);
  } catch (err) {
    console.error('[/m] session creation error:', err);
    redirect('/');
  }

  redirect(challenge?.redirectPath ?? '/home');
}
