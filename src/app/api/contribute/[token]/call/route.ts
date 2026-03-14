import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { startVoiceCallForContributor } from '@/lib/voice-calls';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const contributor = await prisma.contributor.findUnique({
      where: { token },
      include: {
        image: true,
      },
    });

    if (!contributor || contributor.image.visibility === 'PRIVATE') {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }

    const result = await startVoiceCallForContributor({
      contributorId: contributor.id,
      initiatedBy: 'contributor',
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error starting contributor voice call:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to start voice call',
      },
      { status: 500 }
    );
  }
}
