import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess } from '@/lib/ember';
import { realContributorWhere } from '@/lib/contributors-pool';
import { prisma } from '@/lib/db';
import { getUserDisplayName } from '@/lib/user-name';

export type PeopleSuggestionContributor = {
  contributorId: string;
  userId: string | null;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  avatarColor: string | null;
  avatarUrl: string | null;
  alreadyTagged: boolean;
};

/**
 * GET /api/images/[id]/people-suggestions
 *
 * Returns the list of "people Ember knows about" for this ember — used by
 * the Tag People picker to suggest contributors when an owner is tagging
 * a face. Excludes the share-link placeholder rows (no identity fields).
 *
 * Each entry includes `alreadyTagged` so the picker can sort un-tagged
 * contributors first.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const ember = await ensureEmberOwnerAccess(auth.user.id, id);
    if (!ember) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const [emberContributors, taggedContributorRows] = await Promise.all([
      prisma.emberContributor.findMany({
        where: {
          imageId: id,
          contributor: {
            AND: [
              realContributorWhere,
              // Skip the owner's own contributor row.
              { OR: [{ userId: null }, { NOT: { userId: auth.user.id } }] },
            ],
          },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          contributor: {
            select: {
              userId: true,
              name: true,
              email: true,
              phoneNumber: true,
              avatarColor: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatarFilename: true,
                },
              },
            },
          },
        },
      }),
      prisma.imageTag.findMany({
        where: { imageId: id, emberContributorId: { not: null } },
        select: { emberContributorId: true },
      }),
    ]);

    const taggedContributorIds = new Set(
      taggedContributorRows
        .map((t) => t.emberContributorId)
        .filter((cid): cid is string => Boolean(cid))
    );

    const result: PeopleSuggestionContributor[] = emberContributors.map((ec) => ({
      contributorId: ec.id,
      userId: ec.contributor.userId,
      name:
        getUserDisplayName(ec.contributor.user) ??
        ec.contributor.name ??
        ec.contributor.user?.email ??
        ec.contributor.email ??
        ec.contributor.phoneNumber ??
        'Contributor',
      email: ec.contributor.email ?? ec.contributor.user?.email ?? null,
      phoneNumber: ec.contributor.phoneNumber,
      avatarColor: ec.contributor.avatarColor ?? null,
      avatarUrl: ec.contributor.user?.avatarFilename
        ? `/api/uploads/${ec.contributor.user.avatarFilename}`
        : null,
      alreadyTagged: taggedContributorIds.has(ec.id),
    }));

    return NextResponse.json({ contributors: result });
  } catch (error) {
    console.error('People suggestions error:', error);
    return NextResponse.json({ error: 'Failed to load people' }, { status: 500 });
  }
}
