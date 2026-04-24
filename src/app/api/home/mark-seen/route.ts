import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { prisma } from '@/lib/db';

type Kind = 'contributions' | 'wiki' | 'guestViews';

const FIELD_BY_KIND: Record<Kind, 'lastSeenContributionsAt' | 'lastSeenWikiAt' | 'lastSeenGuestViewsAt'> = {
  contributions: 'lastSeenContributionsAt',
  wiki: 'lastSeenWikiAt',
  guestViews: 'lastSeenGuestViewsAt',
};

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { kind?: Kind; at?: string } = {};
  try {
    body = (await request.json()) as { kind?: Kind; at?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.kind !== 'contributions' && body.kind !== 'wiki' && body.kind !== 'guestViews') {
    return NextResponse.json(
      { error: 'kind must be "contributions", "wiki", or "guestViews"' },
      { status: 400 }
    );
  }

  // `at` is a high-watermark for a specific card being dismissed. If omitted
  // or invalid we fall back to "now" (dismiss everything older than this moment).
  let target: Date;
  if (typeof body.at === 'string') {
    const parsed = new Date(body.at);
    target = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    target = new Date();
  }

  const field = FIELD_BY_KIND[body.kind];

  // Read current value; advance only if target > current. Keeps older swipes
  // from clawing back progress made by newer swipes.
  const current = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { [field]: true } as Record<string, true>,
  });
  const existing = (current as Record<string, Date | null> | null)?.[field] ?? null;
  const next = existing && existing.getTime() > target.getTime() ? existing : target;

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { [field]: next } as Record<string, Date>,
  });

  return NextResponse.json({ ok: true, at: next.toISOString() });
}
