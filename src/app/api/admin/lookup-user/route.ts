import { NextRequest, NextResponse } from 'next/server';
import { PRIMARY_OWNER_EMAIL, requireApiUser } from '@/lib/auth-server';
import { prisma } from '@/lib/db';

const ADMIN_EMAILS = new Set<string>([
  PRIMARY_OWNER_EMAIL.toLowerCase(),
  'amadobatour@gmail.com',
]);

// Debug-only: search User rows by first name, last name, or email.
// Gated to admin emails so it can't be hit by other accounts.
//   GET /api/admin/lookup-user?q=amado
export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ADMIN_EMAILS.has(auth.user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (!q) {
    return NextResponse.json({ error: 'Missing ?q' }, { status: 400 });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({ count: users.length, users });
}
