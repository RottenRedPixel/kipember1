import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { getEmberAccessType } from '@/lib/ember-access';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: emberId } = await params;

    const accessType = await getEmberAccessType(auth.user.id, emberId);
    if (accessType !== 'owner' && accessType !== 'contributor') {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const ember = await prisma.ember.findUnique({
      where: { id: emberId },
      select: { shareToken: true },
    });

    if (!ember) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Backfill: existing rows predating the column get a token now.
    const token = ember.shareToken ?? (await prisma.ember.update({
      where: { id: emberId },
      data: { shareToken: randomUUID() },
      select: { shareToken: true },
    })).shareToken;

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error getting share token:', error);
    return NextResponse.json({ error: 'Failed to get share token' }, { status: 500 });
  }
}
