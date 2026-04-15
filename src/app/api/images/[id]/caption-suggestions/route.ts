import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import { getOpenAIClient, getWikiModel } from '@/lib/openai';
import { loadEmberSetupContext } from '@/lib/ember-setup-context';

function normalizeCaption(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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
    const image = await ensureImageOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const requestedVoice =
      typeof body?.voice === 'string' && body.voice.trim() ? body.voice.trim() : null;

    const context = await loadEmberSetupContext(id);
    if (!context) {
      return NextResponse.json({ error: 'Ember not found' }, { status: 404 });
    }

    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      model: getWikiModel(),
      input: [
        {
          role: 'developer',
          type: 'message',
          content: [
            {
              type: 'input_text',
              text: `You are generating a Smart Caption for an Ember memory.

Write a short, human, emotionally grounded caption for this memory.

Rules:
- Use only details supported by the provided context.
- Make it feel like a memory, not metadata or analysis.
- No headings, bullets, labels, or explanations.
- Keep it concise: 2-4 short paragraphs or lines total.
- If the date is clearly supported, you may open with a short date line.
- Avoid generic phrases like "This image shows".
- The caption may later be narrated aloud, so it should sound natural when spoken.
${requestedVoice ? `- Write it so it sounds natural in the voice style of "${requestedVoice}".` : ''}

Return only the caption text.`,
            },
          ],
        },
        {
          role: 'user',
          type: 'message',
          content: [
            {
              type: 'input_text',
              text: context.promptContext,
            },
          ],
        },
      ],
      text: {
        verbosity: 'low',
      },
    });

    const caption = normalizeCaption(response.output_text || '');

    if (!caption) {
      return NextResponse.json(
        { error: 'Failed to generate a smart caption' },
        { status: 500 }
      );
    }

    return NextResponse.json({ caption });
  } catch (error) {
    console.error('Smart caption generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate a smart caption' },
      { status: 500 }
    );
  }
}
