import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const COOKIE_NAME = 'mw_access';

export async function requireAccess(): Promise<NextResponse | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await prisma.accessSession.findUnique({
    where: { token },
    include: { pass: true },
  });

  if (!session || !session.active || !session.pass.active) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
