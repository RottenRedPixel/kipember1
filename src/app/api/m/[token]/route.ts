import { NextRequest, NextResponse } from 'next/server';
import { consumeSmsSigninChallenge } from '@/lib/auth-challenges';
import { applyUserSessionCookie, claimMemoriesForUser, createUserSession } from '@/lib/auth-server';
import { getAppBaseUrl } from '@/lib/app-url';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const baseUrl = getAppBaseUrl();
  const { token } = await params;

  try {
    const challenge = await consumeSmsSigninChallenge(token);

    if (!challenge?.userId) {
      return NextResponse.redirect(`${baseUrl}/signin?error=link-expired`);
    }

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
      },
    });

    if (!user) {
      return NextResponse.redirect(`${baseUrl}/signin?error=link-expired`);
    }

    await claimMemoriesForUser(user);

    const sessionToken = await createUserSession(user.id);
    const response = NextResponse.redirect(`${baseUrl}${challenge.redirectPath}`);
    applyUserSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    console.error('SMS magic link error:', error);
    return NextResponse.redirect(`${baseUrl}/signin?error=link-expired`);
  }
}
