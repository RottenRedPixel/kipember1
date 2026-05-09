import { NextRequest, NextResponse } from 'next/server';
import { claimMemoriesForUser, createUserSession, applyUserSessionCookie } from '@/lib/auth-server';
import { findSmsSigninChallenge, markSmsSigninChallengeConsumed } from '@/lib/auth-challenges';
import { prisma } from '@/lib/db';
import { getAppBaseUrl } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const baseUrl = getAppBaseUrl();

  const challenge = await findSmsSigninChallenge(token).catch(() => null);
  if (!challenge?.userId) {
    return NextResponse.redirect(`${baseUrl}/link-expired`, { status: 302 });
  }

  const user = await prisma.user.findUnique({
    where: { id: challenge.userId },
    select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true, passwordHash: true },
  }).catch(() => null);

  if (!user) {
    return NextResponse.redirect(`${baseUrl}/link-expired`, { status: 302 });
  }

  try {
    await claimMemoriesForUser(user);
    const sessionToken = await createUserSession(user.id);
    await markSmsSigninChallengeConsumed(challenge.id);

    // Return 200 HTML with Set-Cookie + meta refresh.
    // Cookies on redirect responses are silently dropped by mobile browsers;
    // cookies on a 200 HTML response are always processed.
    // If the user has no password yet, send them to set one regardless of the
    // original redirect destination — otherwise they stay permanently locked out.
    const redirectPath = !user.passwordHash ? '/set-password' : challenge.redirectPath;
    const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${redirectPath}"></head><body>Signing in...</body></html>`;
    const response = new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
    applyUserSessionCookie(response, sessionToken);
    return response;
  } catch {
    return NextResponse.redirect(`${baseUrl}/link-expired`, { status: 302 });
  }
}
