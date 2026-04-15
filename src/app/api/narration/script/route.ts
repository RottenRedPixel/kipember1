import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { buildNarrationText, cleanNarrationScript } from '@/lib/narration';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as
      | {
          content?: string;
        }
      | null;

    const content = typeof body?.content === 'string' ? body.content : '';
    const narrationText = buildNarrationText(content);

    if (!narrationText) {
      return NextResponse.json(
        { error: 'There is no story content available to narrate yet.' },
        { status: 400 }
      );
    }

    const script = await cleanNarrationScript(narrationText);

    return NextResponse.json({ script });
  } catch (error) {
    console.error('Narration script error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to prepare narration text',
      },
      { status: 500 }
    );
  }
}
