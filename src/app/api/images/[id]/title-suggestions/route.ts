import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import {
  PROMPT_REMOVED_MESSAGE,
  isPromptRemovedError,
  renderPromptTemplate,
} from '@/lib/control-plane';
import { ensureEmberOwnerAccess } from '@/lib/ember';
import { getConfiguredOpenAIModel, getOpenAIClient, getWikiModel } from '@/lib/openai';
import { loadEmberSetupContext } from '@/lib/ember-setup-context';
import { prisma } from '@/lib/db';

type SmartTitleSuggestionCache = {
  suggestions: string[];
  preferredPeople: string[];
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
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    titles.push(line);
  }

  return titles.slice(0, 3);
}

function parseCache(value: string | null | undefined): SmartTitleSuggestionCache | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<SmartTitleSuggestionCache>;
    const suggestions = Array.isArray(parsed?.suggestions)
      ? parsed.suggestions.filter((s): s is string => typeof s === 'string')
      : [];
    const preferredPeople = Array.isArray(parsed?.preferredPeople)
      ? parsed.preferredPeople.filter((s): s is string => typeof s === 'string')
      : [];
    if (suggestions.length === 0) return null;
    return { suggestions, preferredPeople };
  } catch {
    return null;
  }
}

// Order-insensitive, case-insensitive signature so the cache hits whether the
// UI sends "Zia,Luca" or "luca, zia".
function preferredPeopleSignature(names: string[]) {
  return [...names].map((n) => n.trim().toLowerCase()).filter(Boolean).sort().join('|');
}

async function generateTitles({
  fullContext,
  taggedPeople,
  preferredPeople,
}: {
  fullContext: string;
  taggedPeople: string[];
  preferredPeople: string[];
}) {
  const preferredSet = new Set(preferredPeople);
  const optional = taggedPeople.filter((p) => !preferredSet.has(p));

  const prompt = await renderPromptTemplate('title_generation.regenerate', '', {
    fullContext,
    peopleInstruction: taggedPeople.join(', '),
    preferredPeopleInstruction: preferredPeople.join(', '),
    optionalTaggedPeopleInstruction: optional.join(', '),
  });

  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: await getConfiguredOpenAIModel('title_suggestions', getWikiModel()),
    input: [
      {
        role: 'user',
        type: 'message',
        content: [{ type: 'input_text', text: prompt }],
      },
    ],
    text: { verbosity: 'low' },
  });

  return parseTitleList(response.output_text || '');
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
    const image = await ensureEmberOwnerAccess(auth.user.id, id);
    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';
    const cachedOnly = request.nextUrl.searchParams.get('cachedOnly') === '1';
    const preferredPeopleParam = request.nextUrl.searchParams.get('preferredPeople');
    const preferredPeople = preferredPeopleParam
      ? preferredPeopleParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const requestedSig = preferredPeopleSignature(preferredPeople);

    const cachedImage = await prisma.image.findUnique({
      where: { id },
      select: { smartTitleSuggestionsJson: true },
    });

    // Cache-only mode: return whatever is in the DB without ever generating.
    // The Edit Title slider uses this on Edit-mode entry so the user sees
    // the last set of ideas instantly; Regen Ideas is the only path that
    // triggers a new generation.
    if (cachedOnly) {
      const cached = parseCache(cachedImage?.smartTitleSuggestionsJson);
      return NextResponse.json({ suggestions: cached?.suggestions ?? [] });
    }

    if (!forceRefresh) {
      const cached = parseCache(cachedImage?.smartTitleSuggestionsJson);
      if (cached && preferredPeopleSignature(cached.preferredPeople) === requestedSig) {
        return NextResponse.json({ suggestions: cached.suggestions });
      }
    }

    const context = await loadEmberSetupContext(id);
    if (!context) {
      return NextResponse.json({ error: 'Ember not found' }, { status: 404 });
    }

    const suggestions = await generateTitles({
      fullContext: context.promptContext,
      taggedPeople: context.confirmedPeople,
      preferredPeople,
    });

    await prisma.image.update({
      where: { id },
      data: {
        smartTitleSuggestionsJson: JSON.stringify({ suggestions, preferredPeople }),
        smartTitleSuggestionsUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Title suggestion error:', error);
    if (isPromptRemovedError(error)) {
      return NextResponse.json({ error: PROMPT_REMOVED_MESSAGE }, { status: 500 });
    }
    return NextResponse.json(
      { error: 'Failed to generate title suggestions' },
      { status: 500 }
    );
  }
}
