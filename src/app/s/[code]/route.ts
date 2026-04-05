import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    void request;
    const { code } = await params;

    const shortLink = await prisma.shortLink.findUnique({
      where: { code },
    });

    if (!shortLink) {
      return NextResponse.json({ error: 'Short link not found' }, { status: 404 });
    }

    await prisma.shortLink.update({
      where: { id: shortLink.id },
      data: {
        visitCount: {
          increment: 1,
        },
        lastVisitedAt: new Date(),
      },
    });

    return NextResponse.redirect(shortLink.targetUrl, 307);
  } catch (error) {
    console.error('Short link redirect failed:', error);
    return NextResponse.json({ error: 'Short link redirect failed' }, { status: 500 });
  }
}
