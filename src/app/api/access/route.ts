import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateSalt, generateSessionToken, hashPasscode } from '@/lib/access';

const COOKIE_NAME = 'mw_access';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function POST(request: NextRequest) {
  try {
    const { passcode, label } = await request.json();

    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json({ error: 'Passcode is required' }, { status: 400 });
    }

    const pass = await prisma.accessPass.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!pass) {
      return NextResponse.json({ error: 'No access passcodes configured' }, { status: 403 });
    }

    const hash = hashPasscode(passcode, pass.salt);
    if (hash !== pass.codeHash) {
      return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
    }

    const token = generateSessionToken();
    await prisma.accessSession.create({
      data: {
        token,
        passId: pass.id,
      },
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Access error:', error);
    return NextResponse.json({ error: 'Failed to verify passcode' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { passcode, label } = await request.json();

    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json({ error: 'Passcode is required' }, { status: 400 });
    }

    const adminKey = request.headers.get('x-admin-key');
    if (!adminKey || adminKey !== process.env.ACCESS_ADMIN_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const salt = generateSalt();
    const codeHash = hashPasscode(passcode, salt);

    const pass = await prisma.accessPass.create({
      data: { codeHash, salt, label: label || null },
    });

    return NextResponse.json({ success: true, id: pass.id });
  } catch (error) {
    console.error('Access create error:', error);
    return NextResponse.json({ error: 'Failed to create passcode' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key');
    if (!adminKey || adminKey !== process.env.ACCESS_ADMIN_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { passId } = await request.json();
    if (!passId) {
      return NextResponse.json({ error: 'passId is required' }, { status: 400 });
    }

    await prisma.accessPass.update({
      where: { id: passId },
      data: { active: false, revokedAt: new Date() },
    });

    await prisma.accessSession.updateMany({
      where: { passId, active: true },
      data: { active: false, revokedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Access revoke error:', error);
    return NextResponse.json({ error: 'Failed to revoke passcode' }, { status: 500 });
  }
}
