import { NextRequest, NextResponse } from 'next/server';
import { claimMemoriesForUser, createUserSession, applyUserSessionCookie } from '@/lib/auth-server';
import { findSmsSigninChallenge, markSmsSigninChallengeConsumed } from '@/lib/auth-challenges';
import { prisma } from '@/lib/db';
import { getAppBaseUrl } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

// Intermediate confirmation page shown on GET.
// Link previewers (iOS Messages, Android, carrier scanners) fire a GET to
// every URL in an SMS; if we create the session on GET the challenge is
// consumed before the user ever taps the link.
// Requiring an explicit POST (the "Sign in" button below) means only the user's
// intentional tap actually consumes the challenge.
function buildConfirmPage(token: string, firstName: string | null): string {
  const name = firstName ? `Hi ${firstName}, ` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in to Ember</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f0f0f;
      color: #fff;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      max-width: 360px;
      width: 100%;
    }
    .logo {
      width: 56px;
      height: 56px;
    }
    h1 { font-size: 22px; font-weight: 700; text-align: center; }
    p { font-size: 14px; color: rgba(255,255,255,0.5); text-align: center; line-height: 1.5; }
    button {
      width: 100%;
      min-height: 48px;
      border-radius: 9999px;
      background: #f97316;
      color: #fff;
      font-size: 15px;
      font-weight: 600;
      border: none;
      cursor: pointer;
    }
    button:active { opacity: 0.85; }
  </style>
</head>
<body>
  <div class="card">
    <svg class="logo" viewBox="0 0 72 72" fill="white" xmlns="http://www.w3.org/2000/svg">
      <circle cx="36" cy="36" r="7.2" fill="#f97316"/>
      <rect x="32.4" y="3.18" width="7.2" height="21.6" rx="3.6"/>
      <rect x="32.4" y="47.22" width="7.2" height="21.6" rx="3.6"/>
      <rect x="10.38" y="25.2" width="7.2" height="21.6" rx="3.6" transform="translate(-22.02 49.98) rotate(-90)"/>
      <rect x="54.42" y="25.2" width="7.2" height="21.6" rx="3.6" transform="translate(22.02 94.02) rotate(-90)"/>
      <rect x="47.97" y="9.63" width="7.2" height="21.6" rx="3.6" transform="translate(29.55 -30.48) rotate(45)"/>
      <rect x="16.83" y="40.77" width="7.2" height="21.6" rx="3.6" transform="translate(42.45 .66) rotate(45)"/>
      <rect x="16.83" y="9.63" width="7.2" height="21.6" rx="3.6" transform="translate(-8.46 20.43) rotate(-45)"/>
      <rect x="47.97" y="40.77" width="7.2" height="21.6" rx="3.6" transform="translate(-21.36 51.57) rotate(-45)"/>
    </svg>
    <h1>${name}tap below to sign in</h1>
    <p>Your one-tap sign-in link is ready. Tap the button to continue to Ember.</p>
    <form method="POST" action="/m/${token}" style="width:100%">
      <button type="submit">Sign in to Ember</button>
    </form>
  </div>
</body>
</html>`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const baseUrl = getAppBaseUrl();

  // Validate the challenge without consuming it — previewers stop here.
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

  // Show confirmation page — the user's tap triggers the POST below.
  return new NextResponse(buildConfirmPage(token, user.firstName), {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const baseUrl = getAppBaseUrl();

  // Re-validate — the challenge could have been consumed between GET and POST
  // (e.g. user tapped the link twice).
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
