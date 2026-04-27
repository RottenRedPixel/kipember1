import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import {
  PROMPT_REMOVED_MESSAGE,
  isPromptRemovedError,
  renderPromptTemplate,
} from '@/lib/control-plane';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import { getConfiguredOpenAIModel, getOpenAIClient, getWikiModel } from '@/lib/openai';
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

    const prompt = await renderPromptTemplate('snapshot_generation.regenerate', '', {
      voiceStyle: requestedVoice || '',
      voiceInstruction: requestedVoice || '',
    });

    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      model: await getConfiguredOpenAIModel('caption_generation', getWikiModel()),
      input: [
        {
          role: 'developer',
          type: 'message',
          content: [
            {
              type: 'input_text',
              text: prompt,
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
    if (isPromptRemovedError(error)) {
      return NextResponse.json({ error: PROMPT_REMOVED_MESSAGE }, { status: 500 });
    }
    return NextResponse.json(
      { error: 'Failed to generate a smart caption' },
      { status: 500 }
    );
  }
}
