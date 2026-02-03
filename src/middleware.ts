import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const COOKIE_NAME = 'mw_access';

const PUBLIC_PATHS = new Set([
  '/access',
  '/api/access',
  '/favicon.ico',
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }
  if (pathname.startsWith('/_next')) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return handleUnauthorized(request);
  }

  const session = await prisma.accessSession.findUnique({
    where: { token },
    include: { pass: true },
  });

  if (!session || !session.active || !session.pass.active) {
    return handleUnauthorized(request);
  }

  return NextResponse.next();
}

function handleUnauthorized(request: NextRequest) {
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
  if (isApiRoute) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = '/access';
  redirectUrl.searchParams.set('returnTo', request.nextUrl.pathname);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|robots.txt|sitemap.xml).*)'],
};
