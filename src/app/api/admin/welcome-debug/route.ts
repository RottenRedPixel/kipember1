import { NextRequest, NextResponse } from 'next/server';
import { PRIMARY_OWNER_EMAIL, requireApiUser } from '@/lib/auth-server';
import { prisma } from '@/lib/db';

const ADMIN_EMAILS = new Set<string>([
  PRIMARY_OWNER_EMAIL.toLowerCase(),
  'amadobatour@gmail.com',
]);

// Debug-only: replicate the prefix of the welcome route -- look up the
// signed-in user's firstName the same way and report what userFirstName
// would have been passed to the prompt template, without actually
// generating a welcome.
//
//   GET /api/admin/welcome-debug
export async function GET(_request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ADMIN_EMAILS.has(auth.user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  // 1) What's on the session-hydrated auth.user object?
  const sessionUser = {
    id: auth.user.id,
    email: auth.user.email,
    firstName: auth.user.firstName,
    lastName: auth.user.lastName,
  };

  // 2) Re-do the exact lookup the welcome route does.
  const userRecord = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { firstName: true, lastName: true, email: true },
  });

  // 3) Compute userFirstName the exact same way welcome route does.
  const userFirstName = userRecord?.firstName?.trim() || '';

  // 4) ownedEmberCount + isFirstEmber, same logic as welcome route.
  const ownedEmberCount = await prisma.image.count({
    where: { ownerId: auth.user.id },
  });
  const isFirstEmber = ownedEmberCount <= 1;

  return NextResponse.json({
    sessionUser,
    userRecord,
    userFirstName,
    userFirstNameIsEmpty: userFirstName.length === 0,
    ownedEmberCount,
    isFirstEmber,
  });
}
