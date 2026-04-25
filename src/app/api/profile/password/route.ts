import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser, hashPassword, verifyPassword } from '@/lib/auth-server';
import { prisma } from '@/lib/db';

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { currentPassword?: unknown; newPassword?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword) {
    return NextResponse.json({ error: 'Current password is required.' }, { status: 400 });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }
  if (newPassword === currentPassword) {
    return NextResponse.json(
      { error: 'New password must be different from current password.' },
      { status: 400 }
    );
  }

  // Fetch the stored hash to verify the current password.
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
  }

  // Update password hash and revoke all other sessions. Keeps the current
  // session alive so the user stays signed in on this device.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: auth.user.id },
      data: { passwordHash: hashPassword(newPassword) },
    }),
    prisma.userSession.deleteMany({
      where: {
        userId: auth.user.id,
        id: { not: auth.session.id },
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
