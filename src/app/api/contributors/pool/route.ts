import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { getUnifiedContributorsForUser } from '@/lib/contributors-pool';

/**
 * GET /api/contributors/pool[?emberId=X]
 *
 * Returns the deduped pool of unique contributors across all the user's owned
 * embers. When `emberId` is provided, each row carries `onThisEmber` and
 * `currentEmberContributorId`. Powers the unified Contributors list used in
 * both /tend/contributors and /account.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const emberId = url.searchParams.get('emberId');

  try {
    const contributors = await getUnifiedContributorsForUser(auth.user.id, emberId || undefined);
    return NextResponse.json({ contributors });
  } catch (error) {
    console.error('Error loading contributor pool:', error);
    return NextResponse.json({ error: 'Failed to load contributors' }, { status: 500 });
  }
}
