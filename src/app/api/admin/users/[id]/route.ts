import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuth } from '@/lib/auth-server';
import { isAdmin } from '@/lib/admin-access';
import { prisma } from '@/lib/db';

/**
 * DELETE /api/admin/users/[id]
 *
 * Permanently deletes a user. Cascades through every Prisma relation
 * declared with onDelete: Cascade — owned embers, their wikis,
 * snapshots, contributors, ember sessions, memory claims, etc. all go.
 * Tags and Contributor rows that point at the user via SetNull just
 * lose the link.
 *
 * Admin-only. Prevents deleting your own account from this surface so
 * you don't accidentally lock yourself out — sign out and use the
 * normal account-delete flow if that's actually what you want.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentAuth();
  if (!auth || !isAdmin(auth.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  if (id === auth.user.id) {
    return NextResponse.json(
      { error: "Can't delete your own admin account from here." },
      { status: 400 }
    );
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin user delete error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
