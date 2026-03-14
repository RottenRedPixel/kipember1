import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import { prisma } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, tagId } = await params;
    const image = await ensureImageOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    await prisma.imageTag.deleteMany({
      where: {
        id: tagId,
        imageId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tag delete error:', error);
    return NextResponse.json(
      { error: 'Failed to remove tag' },
      { status: 500 }
    );
  }
}
