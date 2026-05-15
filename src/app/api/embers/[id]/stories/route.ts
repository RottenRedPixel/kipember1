import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess } from '@/lib/ember';

import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

// GET — list all composed stories for this ember (newest first).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const ember = await ensureEmberOwnerAccess(auth.user.id, id);
    if (!ember) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const stories = await prisma.emberStory.findMany({
      where: { emberId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        script: true,
        facetsJson: true,
        peopleJson: true,
        durationSeconds: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      stories: stories.map((s) => ({
        id: s.id,
        script: s.script,
        facets: JSON.parse(s.facetsJson) as string[],
        people: JSON.parse(s.peopleJson) as string[],
        durationSeconds: s.durationSeconds,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Stories list error:', error);
    return NextResponse.json({ error: 'Failed to load stories.' }, { status: 500 });
  }
}

// POST — save a played story.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const ember = await ensureEmberOwnerAccess(auth.user.id, id);
    if (!ember) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const script = typeof body?.script === 'string' && body.script.trim() ? body.script.trim() : '';
    const facets: string[] = Array.isArray(body?.facets) ? body.facets : [];
    const people: string[] = Array.isArray(body?.people) ? body.people : [];
    const durationSeconds =
      typeof body?.durationSeconds === 'number' && body.durationSeconds >= 5
        ? body.durationSeconds
        : 20;

    if (!script) return NextResponse.json({ error: 'Script is required.' }, { status: 400 });

    const story = await prisma.emberStory.create({
      data: {
        emberId: id,
        script,
        facetsJson: JSON.stringify(facets),
        peopleJson: JSON.stringify(people),
        durationSeconds,
      },
    });

    return NextResponse.json({
      story: {
        id: story.id,
        facets,
        people,
        durationSeconds: story.durationSeconds,
        createdAt: story.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Story save error:', error);
    return NextResponse.json({ error: 'Failed to save story.' }, { status: 500 });
  }
}
