import { NextRequest, NextResponse } from 'next/server';
import { getAppBaseUrl } from '@/lib/app-url';

// Redirect to the server-page handler which sets the session cookie
// reliably via next/headers before redirect()-ing to the ember.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const baseUrl = getAppBaseUrl();
  const { token } = await params;
  return NextResponse.redirect(`${baseUrl}/m/${token}`, { status: 301 });
}
