import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuth } from '@/lib/auth-server';
import { isAdmin } from '@/lib/admin-access';
import { prisma } from '@/lib/db';

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth || !isAdmin(auth.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const steps = await prisma.progressTrackerStep.findMany({
    orderBy: { position: 'asc' },
  });

  return NextResponse.json({ steps });
}

export async function PATCH(request: NextRequest) {
  const auth = await getCurrentAuth();
  if (!auth || !isAdmin(auth.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
  }
  const { slug, enabled, ownerRequired, contributorMin } = body as {
    slug?: unknown;
    enabled?: unknown;
    ownerRequired?: unknown;
    contributorMin?: unknown;
  };
  if (typeof slug !== 'string') {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  // Build a partial update — only include fields the caller actually sent.
  const data: {
    enabled?: boolean;
    ownerRequired?: boolean;
    contributorMin?: number | null;
  } = {};
  if (enabled !== undefined) {
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
    }
    data.enabled = enabled;
  }
  if (ownerRequired !== undefined) {
    if (typeof ownerRequired !== 'boolean') {
      return NextResponse.json({ error: 'ownerRequired must be a boolean' }, { status: 400 });
    }
    data.ownerRequired = ownerRequired;
  }
  if (contributorMin !== undefined) {
    if (contributorMin === null) {
      data.contributorMin = null;
    } else if (typeof contributorMin === 'number' && Number.isInteger(contributorMin) && contributorMin >= 0) {
      data.contributorMin = contributorMin;
    } else {
      return NextResponse.json(
        { error: 'contributorMin must be a non-negative integer or null' },
        { status: 400 }
      );
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const updated = await prisma.progressTrackerStep.update({
      where: { slug },
      data,
    });
    return NextResponse.json({ step: updated });
  } catch {
    return NextResponse.json({ error: 'Step not found' }, { status: 404 });
  }
}
