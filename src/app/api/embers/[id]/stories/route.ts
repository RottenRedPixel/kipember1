import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess, getEmberAccessType } from '@/lib/ember';
import { getUserDisplayName } from '@/lib/user-name';

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
        authorType: true,
        authorId: true,
        authorName: true,
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
        authorType: s.authorType,
        authorId: s.authorId,
        authorName: s.authorName,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Stories list error:', error);
    return NextResponse.json({ error: 'Failed to load stories.' }, { status: 500 });
  }
}

// POST — save a played story.
// Accepts three auth paths:
//   1. ?token= query param (share-link viewer or contributor token) → authorType 'guest'
//   2. Session auth — owner                                         → authorType 'owner'
//   3. Session auth — contributor                                   → authorType 'contributor'
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let authorType: string;
    let authorId: string | null;
    let authorName: string;

    const tokenParam = request.nextUrl.searchParams.get('token');
    if (tokenParam) {
      // Validate share token or contributor token for this ember
      const [contributor, emberByShare] = await Promise.all([
        prisma.emberContributor.findUnique({ where: { token: tokenParam }, select: { emberId: true } }),
        prisma.ember.findUnique({ where: { shareToken: tokenParam }, select: { id: true } }),
      ]);
      const allowed = contributor?.emberId === id || emberByShare?.id === id;
      if (!allowed) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      authorType = 'guest';
      authorId   = null;
      authorName = 'Guest';
    } else {
      const auth = await requireApiUser();
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const accessType = await getEmberAccessType(auth.user.id, id);
      if (!accessType || accessType === 'network') {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      }
      authorType = accessType === 'owner' ? 'owner' : 'contributor';
      authorId   = auth.user.id;
      authorName = getUserDisplayName(auth.user) || auth.user.email || 'Unknown';
    }

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
        authorType,
        authorId,
        authorName,
      },
    });

    return NextResponse.json({
      story: {
        id: story.id,
        facets,
        people,
        durationSeconds: story.durationSeconds,
        authorType: story.authorType,
        authorName: story.authorName,
        createdAt: story.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Story save error:', error);
    return NextResponse.json({ error: 'Failed to save story.' }, { status: 500 });
  }
}
