import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser, hashPassword } from '@/lib/auth-server';
import { prisma } from '@/lib/db';

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (auth.user.passwordHash) {
    return NextResponse.json({ error: 'Account already has a password. Use change password instead.' }, { status: 400 });
  }

  let body: { password?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { passwordHash: hashPassword(password) },
  });

  return NextResponse.json({ ok: true });
}
