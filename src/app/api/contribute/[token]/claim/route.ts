// Auto-authenticates a contributor via their permanent share token so they
// can set a password without first needing to log in. Only works when the
// user has no password yet — once a password is set, normal login applies.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { claimMemoriesForUser, createUserSession, applyUserSessionCookie } from '@/lib/auth-server';
import { getAppBaseUrl } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const baseUrl = getAppBaseUrl();

  const emberContributor = await prisma.emberContributor.findUnique({
    where: { token },
    select: {
      userId: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true, passwordHash: true } },
    },
  }).catch(() => null);

  if (!emberContributor?.user) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  // Once they have a password, send to normal login rather than bypassing it
  if (emberContributor.user.passwordHash) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  try {
    await claimMemoriesForUser(emberContributor.user);
    const sessionToken = await createUserSession(emberContributor.user.id);

    // 200 + meta-refresh so the Set-Cookie lands on mobile (cookies on
    // redirect responses are silently dropped by some mobile browsers)
    const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/set-password"></head><body>Setting up your account...</body></html>`;
    const response = new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
    applyUserSessionCookie(response, sessionToken);
    return response;
  } catch {
    return NextResponse.redirect(`${baseUrl}/login`);
  }
}
