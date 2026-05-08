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

  const challenge = await consumeSmsSigninChallenge(token);
  if (!challenge?.userId) {
    redirect('/signin?error=link-expired');
  }

  const user = await prisma.user.findUnique({
    where: { id: challenge.userId },
    select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
  });

  if (!user) {
    redirect('/signin?error=link-expired');
  }

  await claimMemoriesForUser(user);

  const sessionToken = await createUserSession(user.id);
  await setUserSessionCookie(sessionToken);
  redirect(challenge.redirectPath);
}
