import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess } from '@/lib/ember';
import {
  suggestFaceMatchesForImage,
  type FaceBox,
} from '@/lib/face-match-suggestions';
import { PROMPT_REMOVED_MESSAGE, isPromptRemovedError } from '@/lib/control-plane';

/**
 * Per-face match suggestions — used by the per-tag picker's
 * "Suggest from photo" button. Bulk auto-detect was removed; for
 * the full detect+match pipeline, see /api/images/[id]/auto-tag.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const image = await ensureEmberOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await request.json();
    const faces = Array.isArray(body?.faces) ? (body.faces as FaceBox[]) : [];

    const suggestions = await suggestFaceMatchesForImage({
      ownerId: auth.user.id,
      imageId: id,
      faces,
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Face suggestion error:', error);
    if (isPromptRemovedError(error)) {
      return NextResponse.json({ error: PROMPT_REMOVED_MESSAGE }, { status: 500 });
    }
    return NextResponse.json(
      { error: 'Failed to suggest tags' },
      { status: 500 }
    );
  }
}
