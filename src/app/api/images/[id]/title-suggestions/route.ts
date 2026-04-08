import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import { getOpenAIClient, getWikiModel } from '@/lib/openai';
import { loadEmberSetupContext } from '@/lib/ember-setup-context';
import { prisma } from '@/lib/db';

type ContributorQuoteSuggestion = {
  title: string;
  contributorName: string;
  quote: string;
  source: 'voice' | 'text';
};

type SmartTitleSuggestionCache = {
  analysisSuggestions: string[];
  contextSuggestions: string[];
  contributorQuotes: ContributorQuoteSuggestion[];
};

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

function compactLines(lines: Array<string | null | undefined>) {
  return lines
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join('\n');
}

function trimQuote(value: string, maxLength = 180) {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeQuotedTitle(value: string) {
  const normalized = normalizeTitleLine(value)
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  return `"${normalized}"`;
}

function buildFallbackQuotedTitle(value: string) {
  const compact = value
    .replace(/\s+/g, ' ')
    .replace(/[.?!]+$/g, '')
    .trim();

  if (!compact) {
    return '';
  }

  const firstSentence = compact.split(/(?<=[.?!])\s+/)[0]?.trim() || compact;
  const words = firstSentence.split(/\s+/).filter(Boolean);
  const excerpt = words.slice(0, 8).join(' ');

  return normalizeQuotedTitle(excerpt || firstSentence);
}

function parseJsonArray(value: string) {
  const match = value.match(/\[[\s\S]*\]/);
  if (!match) {
    return [];
  }

  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseSmartTitleSuggestionCache(value: string | null | undefined): SmartTitleSuggestionCache | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<SmartTitleSuggestionCache>;
    const analysisSuggestions = Array.isArray(parsed?.analysisSuggestions)
      ? parsed.analysisSuggestions.filter((item): item is string => typeof item === 'string')
      : [];
    const contextSuggestions = Array.isArray(parsed?.contextSuggestions)
      ? parsed.contextSuggestions.filter((item): item is string => typeof item === 'string')
      : [];
    const contributorQuotes = Array.isArray(parsed?.contributorQuotes)
      ? parsed.contributorQuotes
          .filter(
            (item): item is ContributorQuoteSuggestion =>
              Boolean(item) &&
              typeof item.title === 'string' &&
              typeof item.contributorName === 'string' &&
              typeof item.quote === 'string' &&
              (item.source === 'voice' || item.source === 'text')
          )
          .map((item) => ({
            ...item,
            title: normalizeQuotedTitle(item.title) || buildFallbackQuotedTitle(item.quote),
            quote: trimQuote(item.quote),
          }))
          .filter((item) => item.title && item.quote)
      : [];

    if (
      analysisSuggestions.length === 0 &&
      contextSuggestions.length === 0 &&
      contributorQuotes.length === 0
    ) {
      return null;
    }

    return {
      analysisSuggestions,
      contextSuggestions,
      contributorQuotes,
    };
  } catch {
    return null;
  }
}

async function generateThreeTitles(emberContext: string, mode: 'analysis' | 'context') {
  const openai = getOpenAIClient();
  const modeInstruction =
    mode === 'analysis'
      ? `Generate titles using only what can be inferred from the image itself and its metadata.
- Focus on visible people, setting, activity, mood, place, and time clues.
- Do not invent personal backstory or emotions that only come from conversations.
- Keep the titles visually grounded.`
      : `Generate titles using the human context supplied by the owner or contributors.
- Prefer memorable details from typed memories, voice statements, call highlights, and wiki context.
- Use real wording or emotional details from the people involved when possible.
- Avoid titles that only restate the visual scene if a richer human story is present.`;
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

${modeInstruction}

Each title should:
- Be 2-6 words long
- Capture the essence of the memory
- Feel personal and meaningful
- Avoid generic phrases
- Use specific details when possible
- Prefer distinctive phrases or emotional beats from voice-call highlights when they are present

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

async function generateQuotedTitleSuggestions(
  entries: Array<{
    contributorName: string;
    quote: string;
    source: 'voice' | 'text';
  }>
) {
  if (entries.length === 0) {
    return [];
  }

  const limitedEntries = entries.slice(0, 12);
  const openai = getOpenAIClient();

  try {
    const response = await openai.responses.create({
      model: getWikiModel(),
      input: [
        {
          role: 'developer',
          type: 'message',
          content: [
            {
              type: 'input_text',
              text: `You are generating quote-based Ember title options from real owner and contributor wording.

Choose up to 3 of the strongest quote snippets below and turn each one into a short title.

Rules:
- Use the speaker's actual wording as much as possible.
- Light trimming is allowed, but do not invent facts or rewrite the meaning.
- Each title must be 2-8 words.
- Each title must be wrapped in double quotes.
- Prefer vivid, memorable, title-worthy wording.
- Prefer statements over questions when possible.
- Return strict JSON only.

Return a JSON array like:
[{"index":1,"title":"\\"Best Coffee Ever\\""}]`,
            },
          ],
        },
        {
          role: 'user',
          type: 'message',
          content: [
            {
              type: 'input_text',
              text: limitedEntries
                .map(
                  (entry, index) =>
                    `${index + 1}. ${entry.contributorName} [${entry.source}] "${entry.quote}"`
                )
                .join('\n'),
            },
          ],
        },
      ],
      text: {
        verbosity: 'low',
      },
    });

    const parsed = parseJsonArray(response.output_text || '');
    const seen = new Set<string>();
    const suggestions: ContributorQuoteSuggestion[] = [];

    for (const item of parsed) {
      const entryIndex =
        typeof item?.index === 'number' ? Math.trunc(item.index) - 1 : Number.NaN;
      const entry = limitedEntries[entryIndex];
      if (!entry) {
        continue;
      }

      const title = normalizeQuotedTitle(
        typeof item?.title === 'string' ? item.title : buildFallbackQuotedTitle(entry.quote)
      );
      if (!title) {
        continue;
      }

      const key = title.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      suggestions.push({
        ...entry,
        title,
      });
    }

    if (suggestions.length > 0) {
      return suggestions.slice(0, 3);
    }
  } catch (error) {
    console.error('Quoted title suggestion error:', error);
  }

  const seen = new Set<string>();
  return limitedEntries
    .map((entry) => ({
      ...entry,
      title: buildFallbackQuotedTitle(entry.quote),
    }))
    .filter((entry) => entry.title)
    .filter((entry) => {
      const key = entry.title.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 3);
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
- Any important quoted moment pulled from a voice call
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
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const image = await ensureImageOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';
    const cachedImage = await prisma.image.findUnique({
      where: { id },
      select: {
        smartTitleSuggestionsJson: true,
      },
    });

    if (!forceRefresh) {
      const cachedSuggestions = parseSmartTitleSuggestionCache(
        cachedImage?.smartTitleSuggestionsJson
      );

      if (cachedSuggestions) {
        return NextResponse.json({
          ...cachedSuggestions,
          suggestions: Array.from(
            new Set([
              ...cachedSuggestions.analysisSuggestions,
              ...cachedSuggestions.contextSuggestions,
              ...cachedSuggestions.contributorQuotes.map((item) => item.title),
            ])
          ).slice(0, 9),
        });
      }
    }

    const context = await loadEmberSetupContext(id);
    if (!context) {
      return NextResponse.json({ error: 'Ember not found' }, { status: 404 });
    }

    const analysisContext = compactLines([
      `EMBER TITLE\n${context.imageTitle}`,
      context.image.analysis?.summary ? `IMAGE SUMMARY\n${context.image.analysis.summary}` : null,
      context.image.analysis?.visualDescription
        ? `VISUAL DESCRIPTION\n${context.image.analysis.visualDescription}`
        : null,
      context.image.analysis?.sceneInsightsJson
        ? `SCENE INSIGHTS JSON\n${context.image.analysis.sceneInsightsJson}`
        : null,
      context.confirmedPeople.length > 0
        ? `TAGGED PEOPLE\n${context.confirmedPeople.join(', ')}`
        : null,
      context.confirmedLocation
        ? `CONFIRMED LOCATION\n${[
            context.confirmedLocation.label,
            context.confirmedLocation.detail,
          ]
            .filter(Boolean)
            .join(', ')}`
        : null,
      context.image.analysis?.capturedAt
        ? `CAPTURED AT\n${context.image.analysis.capturedAt.toISOString()}`
        : null,
    ]);
    const humanContext = compactLines([
      `EMBER TITLE\n${context.imageTitle}`,
      context.image.description ? `CAPTION\n${context.image.description}` : null,
      context.contributorMemories.length > 0
        ? `CONTRIBUTOR MEMORIES\n${context.contributorMemories
            .map(
              (memory) =>
                `${memory.contributorName} (${memory.questionType}): ${memory.answer}`
            )
            .join('\n')}`
        : null,
      context.callSummaries.length > 0
        ? `VOICE CALL SUMMARIES\n${context.callSummaries
            .map((call) => `${call.contributorName}: ${call.summary}`)
            .join('\n')}`
        : null,
      context.callHighlights.length > 0
        ? `VOICE CALL HIGHLIGHTS\n${context.callHighlights
            .map((clip) =>
              [
                `${clip.contributorName} - ${clip.title}: "${clip.quote}"`,
                clip.significance ? `Why it matters: ${clip.significance}` : null,
                clip.canUseForTitle ? 'Usable for smart title ideas.' : null,
              ]
                .filter(Boolean)
                .join(' ')
            )
            .join('\n')}`
        : null,
      context.image.attachments.length > 0
        ? `SUPPORTING MEDIA NOTES\n${context.image.attachments
            .filter((attachment) => attachment.description?.trim())
            .map(
              (attachment) =>
                `${attachment.originalName}: ${attachment.description?.trim()}`
            )
            .join('\n')}`
        : null,
      context.image.wiki?.content
        ? `CURRENT WIKI\n${context.image.wiki.content.slice(0, 8000)}`
        : null,
    ]);

    const quoteSourceEntries = Array.from(
      new Map(
        [
          ...context.callHighlights.map((clip) => ({
            contributorName: clip.contributorName,
            quote: clip.quote,
            source: 'voice' as const,
          })),
          ...context.contributorMemories.map((memory) => ({
            contributorName: memory.contributorName,
            quote: memory.answer,
            source: memory.source === 'voice' ? ('voice' as const) : ('text' as const),
          })),
        ]
          .map((entry) => ({
            ...entry,
            quote: trimQuote(entry.quote),
          }))
          .filter((entry) => entry.quote)
          .map((entry) => [`${entry.contributorName.toLowerCase()}::${entry.quote.toLowerCase()}`, entry] as const)
      ).values()
    );
    const [analysisSuggestions, contextSuggestions, contributorQuotes] = await Promise.all([
      generateThreeTitles(analysisContext || context.promptContext, 'analysis'),
      generateThreeTitles(humanContext || context.promptContext, 'context'),
      generateQuotedTitleSuggestions(quoteSourceEntries),
    ]);
    const suggestions = Array.from(
      new Set(
        [...analysisSuggestions, ...contextSuggestions, ...contributorQuotes.map((item) => item.title)].map((title) =>
          title.trim()
        )
      )
    ).slice(0, 9);

    await prisma.image.update({
      where: { id },
      data: {
        smartTitleSuggestionsJson: JSON.stringify({
          analysisSuggestions,
          contextSuggestions,
          contributorQuotes,
        }),
        smartTitleSuggestionsUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({
      analysisSuggestions,
      contextSuggestions,
      contributorQuotes,
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
