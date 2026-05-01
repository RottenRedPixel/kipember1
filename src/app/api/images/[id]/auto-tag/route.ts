import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess } from '@/lib/ember';
import { detectAndMatchFacesInImage } from '@/lib/face-match-suggestions';

/**
 * POST /api/images/[id]/auto-tag
 *
 * Detects every visible face in the cover photo AND matches each one
 * against the owner's previously-tagged faces — both in a single
 * Claude vision call. Returns one entry per detected face, with
 * identity fields (contributorId / userId / label / etc.) populated
 * when a match was found at non-low confidence.
 *
 * Used by the Tag People slider's Auto Detect button.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const ember = await ensureEmberOwnerAccess(auth.user.id, id);
    if (!ember) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const faces = await detectAndMatchFacesInImage({ ownerId: auth.user.id, imageId: id });
    return NextResponse.json({ faces });
  } catch (error) {
    console.error('Auto-tag error:', error);
    return NextResponse.json({ error: 'Failed to auto-tag faces' }, { status: 500 });
  }
}
