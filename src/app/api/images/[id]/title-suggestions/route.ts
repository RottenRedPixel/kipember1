import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import { getOpenAIClient, getWikiModel } from '@/lib/openai';
import { loadEmberSetupContext } from '@/lib/ember-setup-context';

function normalizeTitleLine(value: string) {
  return value
    .replace(/^[-*\d.\s"]+/, '')
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

function parseTitleList(value: string) {
  const seen = new Set<string>();
  const titles: string[] = [];

  for (const rawLine of value.split(/\r?\n/)) {
    const line = normalizeTitleLine(rawLine);
    if (!line) {
      continue;
    }

    const key = line.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    titles.push(line);
  }

  return titles.slice(0, 3);
}

async function generateThreeTitles(emberContext: string) {
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
            text: `You are generating Ember titles.

Based on the context above, generate 3 creative and memorable titles for this moment.

Each title should:
- Be 2-6 words long
- Capture the essence of the memory
- Feel personal and meaningful
- Avoid generic phrases
- Use specific details when possible

Return the titles as a simple list, one per line, without numbers or bullets.`,
          },
        ],
      },
      {
        role: 'user',
        type: 'message',
        content: [
          {
            type: 'input_text',
            text: emberContext,
          },
        ],
      },
    ],
    text: {
      verbosity: 'low',
    },
  });

  return parseTitleList(response.output_text || '');
}

async function generateSingleTitle(emberContext: string) {
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
            text: `You are analyzing a rich memory wiki called an "Ember" to create the perfect title.

This Ember contains layered stories, conversations, and context from multiple contributors.

TASK:
Analyze all the context deeply and generate ONE perfect title that:
1. Captures the emotional essence
2. Reflects the key narrative
3. Incorporates unique details
4. Resonates personally
5. Still feels meaningful years from now

Consider:
- The story conversations and how people are talking about this moment
- The relationships between tagged people
- The setting and context from image analysis
- Emotional undertones or significance mentioned
- Specific details that make this memory unique

Generate ONE thoughtful, evocative title between 2 and 8 words.
Return ONLY the title, with no explanation.`,
          },
        ],
      },
      {
        role: 'user',
        type: 'message',
        content: [
          {
            type: 'input_text',
            text: emberContext,
          },
        ],
      },
    ],
    text: {
      verbosity: 'low',
    },
  });

  return normalizeTitleLine(response.output_text || '');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const image = await ensureImageOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const context = await loadEmberSetupContext(id);
    if (!context) {
      return NextResponse.json({ error: 'Ember not found' }, { status: 404 });
    }

    const suggestions = await generateThreeTitles(context.promptContext);

    return NextResponse.json({
      suggestions,
    });
  } catch (error) {
    console.error('Title suggestion error:', error);
    return NextResponse.json(
      { error: 'Failed to generate title suggestions' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const image = await ensureImageOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const context = await loadEmberSetupContext(id);
    if (!context) {
      return NextResponse.json({ error: 'Ember not found' }, { status: 404 });
    }

    const title = await generateSingleTitle(context.promptContext);

    if (!title) {
      return NextResponse.json(
        { error: 'Failed to generate a title suggestion' },
        { status: 500 }
      );
    }

    return NextResponse.json({ title });
  } catch (error) {
    console.error('Single title generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate a title suggestion' },
      { status: 500 }
    );
  }
}
