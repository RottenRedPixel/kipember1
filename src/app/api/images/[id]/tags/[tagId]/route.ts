import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, normalizePhone, requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess } from '@/lib/ember';
import { prisma } from '@/lib/db';
import { invalidateSmartTitleSuggestions } from '@/lib/smart-title-suggestions';
import { getUserDisplayName } from '@/lib/user-name';
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
    const image = await ensureEmberOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    // Resolve contributor and user FKs first so we can mirror their identity
    // fields onto the tag (POST does the same on create — keep PATCH in sync).
    if (body.contributorId !== undefined) {
      if (body.contributorId === null) {
        updates.emberContributorId = null;
      } else if (typeof body.contributorId === 'string' && body.contributorId) {
        const ec = await prisma.emberContributor.findFirst({
          where: { id: body.contributorId, imageId: id },
          select: {
            id: true,
            contributor: {
              select: { id: true, name: true, email: true, phoneNumber: true, userId: true },
            },
          },
        });
        if (!ec) {
          return NextResponse.json({ error: 'Contributor not found' }, { status: 404 });
        }
        const contributor = ec.contributor;
        updates.emberContributorId = ec.id;
        // If userId wasn't explicitly set in this request, inherit from the contributor.
        if (body.userId === undefined && contributor.userId) {
          updates.userId = contributor.userId;
        }
        // Mirror identity fields onto the tag for legacy display paths that
        // read tag.label / tag.email directly.
        if (typeof body.label !== 'string' && contributor.name) updates.label = contributor.name;
        if (body.email === undefined) updates.email = contributor.email;
        if (body.phoneNumber === undefined) updates.phoneNumber = normalizePhone(contributor.phoneNumber);
      }
    }

    if (body.userId !== undefined) {
      if (body.userId === null) {
        updates.userId = null;
      } else if (typeof body.userId === 'string' && body.userId) {
        const user = await prisma.user.findUnique({
          where: { id: body.userId },
          select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
        });
        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        updates.userId = user.id;
        if (typeof body.label !== 'string') updates.label = getUserDisplayName(user) || user.email;
        if (body.email === undefined) updates.email = user.email;
        if (body.phoneNumber === undefined) updates.phoneNumber = normalizePhone(user.phoneNumber);
      }
    }

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
        emberContributor: {
          select: {
            id: true,
            inviteSent: true,
            contributor: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
              },
            },
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
    const image = await ensureEmberOwnerAccess(auth.user.id, id);

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
