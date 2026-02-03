import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAccess } from '@/lib/access-server';

export async function GET(request: NextRequest) {
  try {
    const access = await requireAccess();
    if (access) return access;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();

    const wikis = await prisma.wiki.findMany({
      where: {
        image: { visibility: 'PUBLIC' },
        ...(query
          ? {
              OR: [
                { content: { contains: query } },
                { image: { originalName: { contains: query } } },
                { image: { description: { contains: query } } },
              ],
            }
          : {}),
      },
      include: {
        image: {
          select: {
            id: true,
            originalName: true,
            description: true,
            filename: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(wikis);
  } catch (error) {
    console.error('Error fetching public wikis:', error);
    return NextResponse.json(
      { error: 'Failed to fetch public wikis' },
      { status: 500 }
    );
  }
}
