import { NextResponse } from 'next/server';
import { clearUserSessionCookie, destroyCurrentSession } from '@/lib/auth-server';

export async function POST() {
  try {
    await destroyCurrentSession();
    const response = NextResponse.json({ success: true });
    clearUserSessionCookie(response);
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Failed to log out' },
      { status: 500 }
    );
  }
}
