import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, normalizePhone, requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import { prisma } from '@/lib/db';
import { invalidateSmartTitleSuggestions } from '@/lib/smart-title-suggestions';
import { generateWikiForImage } from '@/lib/wiki-generator';

function parseOptionalPercentage(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, tagId } = await params;
    const image = await ensureImageOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.label === 'string') {
      const trimmed = body.label.trim();
      if (!trimmed) {
        return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
      }
      updates.label = trimmed;
    }

    if (body.email !== undefined) {
      updates.email =
        typeof body.email === 'string' && body.email.trim() ? normalizeEmail(body.email) : null;
    }

    if (body.phoneNumber !== undefined) {
      updates.phoneNumber = normalizePhone(body.phoneNumber);
    }

    const leftPct = parseOptionalPercentage(body.leftPct);
    const topPct = parseOptionalPercentage(body.topPct);
    const widthPct = parseOptionalPercentage(body.widthPct);
    const heightPct = parseOptionalPercentage(body.heightPct);

    if (leftPct !== undefined) updates.leftPct = leftPct;
    if (topPct !== undefined) updates.topPct = topPct;
    if (widthPct !== undefined) updates.widthPct = widthPct;
    if (heightPct !== undefined) updates.heightPct = heightPct;

    const existingTag = await prisma.imageTag.findFirst({
      where: {
        id: tagId,
        imageId: id,
      },
      select: { id: true },
    });

    if (!existingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    const tag = await prisma.imageTag.update({
      where: { id: existingTag.id },
      data: updates,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
        contributor: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            inviteSent: true,
          },
        },
      },
    });

    await invalidateSmartTitleSuggestions(id).catch((titleError) => {
      console.error('Smart title cache reset failed after tag update:', titleError);
    });

    await generateWikiForImage(id).catch((wikiError) => {
      console.error('Wiki refresh failed after tag update:', wikiError);
    });

    return NextResponse.json({ tag });
  } catch (error) {
    console.error('Tag update error:', error);
    return NextResponse.json(
      { error: 'Failed to update tag' },
      { status: 500 }
    );
  }
}

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

    await invalidateSmartTitleSuggestions(id).catch((titleError) => {
      console.error('Smart title cache reset failed after tag delete:', titleError);
    });

    await generateWikiForImage(id).catch((wikiError) => {
      console.error('Wiki refresh failed after tag delete:', wikiError);
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
