import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';

// ── Playlist narration ────────────────────────────────────────────────────────

export type PlaylistSegment =
  | { type: 'narration'; text: string }
  | { type: 'clip'; index: number };

/**
 * Generate playlist narration — bridging text segments that weave around
 * pre-recorded contributor clips. Returns an ordered array of narration
 * segments and clip references so the caller can assemble snapshot blocks.
 *
 * Prompt MUST exist in the DB (Prompt key: story_generation.playlist).
 * No hardcoded fallback — missing prompt throws and the caller surfaces the error.
 */
export async function generatePlaylistNarration({
  title,
  location,
  clips,
  claimsContext,
  durationSeconds,
}: {
  title: string;
  location: string | null;
  clips: Array<{ index: number; speaker: string; quote: string }>;
  claimsContext: string;
  durationSeconds: number;
}): Promise<PlaylistSegment[]> {
  // Narration is roughly half the target duration — the other half is clips
  const targetWords = Math.round((durationSeconds / 60) * 150 * 0.5);

  // No fallback — prompt must be in DB
  const systemPrompt = await renderPromptTemplate(
    'story_generation.playlist',
    '',
    { targetWords, durationSeconds, clipCount: clips.length }
  );

  const clipsText = clips.map((c) => `[${c.index}] ${c.speaker}: "${c.quote}"`).join('\n');

  const context = [
    `MEMORY TITLE\n${title}`,
    location ? `LOCATION\n${location}` : null,
    `CLIPS\n${clipsText}`,
    claimsContext ? `ADDITIONAL CONTEXT\n${claimsContext}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const raw = await chat(systemPrompt, [{ role: 'user', content: context }]);

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? '{}') as { segments?: unknown[] };
    const segs = Array.isArray(parsed.segments) ? parsed.segments : [];
    return segs.flatMap((s: unknown): PlaylistSegment[] => {
      if (typeof s !== 'object' || !s) return [];
      const seg = s as Record<string, unknown>;
      if (seg.type === 'narration' && typeof seg.text === 'string' && seg.text.trim()) {
        return [{ type: 'narration', text: seg.text.trim() }];
      }
      if (seg.type === 'clip' && typeof seg.index === 'number') {
        return [{ type: 'clip', index: seg.index }];
      }
      return [];
    });
  } catch {
    return raw.trim() ? [{ type: 'narration', text: raw.trim() }] : [];
  }
}

/**
 * Generate a short narration script for a facet-composed Story.
 *
 * Prompt MUST exist in the DB (Prompt key: story_generation.compose).
 * No hardcoded fallback — missing prompt throws and the caller surfaces the error.
 */
const FACET_HUMAN_LABEL: Record<string, string> = {
  place: 'place',
  emotion: 'emotion',
  why: 'why this memory matters',
  extra_story: 'extra story',
  person: 'person',
};

function humanFacetList(facets: string[]): string {
  const labels = facets.map((f) => FACET_HUMAN_LABEL[f] ?? f);
  if (labels.length === 0) return '(none)';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

export async function generateStoryScript({
  title,
  location,
  taggedPeople,
  selectedPeople,
  selectedFacets,
  durationSeconds = 7,
  claimsContext,
  contributorMemoriesContext,
  wikiContent = null,
  verbatimQuotes = '',
  requiredQuotesInstruction = '',
}: {
  title: string;
  location: string | null;
  taggedPeople: string[];
  selectedPeople: string[];
  selectedFacets: string[];
  durationSeconds?: number;
  claimsContext: string;
  contributorMemoriesContext: string;
  wikiContent?: string | null;
  // Raw verbatim text the LLM should quote from — chat messages typed by
  // users, voice transcripts, and call-turn transcripts. Each line is
  // attributed: `[chat|voice|call] <Name>: "<exact words they said>"`.
  verbatimQuotes?: string;
  // Hard requirement passed in when the user explicitly selected people who
  // have verbatim material — e.g. "REQUIRED: include at least one direct
  // verbatim quote from each of these speakers: Amado, Zia." Empty when no
  // requirement applies.
  requiredQuotesInstruction?: string;
}): Promise<string> {
  const targetWords = Math.round((durationSeconds / 60) * 150);

  const peopleInstruction =
    selectedPeople.length === 0
      ? 'No specific people were selected — draw from everyone.'
      : `Focus on: ${selectedPeople.join(', ')}. Only mention others if directly relevant.`;

  // Brief mode: user picked chip(s) but no specific people. The story should
  // ONLY discuss the selected facet(s) — no emotional fluff, no narrative arc,
  // no off-facet exposition. We strip wiki / verbatim / memories from context
  // and pass only the facet-filtered claims, which already carry who said what.
  const briefMode = selectedPeople.length === 0;
  const focusFacets = humanFacetList(selectedFacets);

  // No fallback — prompt must be in DB
  const systemPrompt = await renderPromptTemplate('story_generation.compose', '', {
    targetWords,
    durationSeconds,
    peopleInstruction,
    focusFacets,
    mode: briefMode ? 'brief' : 'narrative',
  });

  const context = briefMode
    ? [
        `MEMORY TITLE\n${title}`,
        location && selectedFacets.includes('place') ? `LOCATION\n${location}` : null,
        claimsContext ? `FACTS GATHERED (only about ${focusFacets})\n${claimsContext}` : null,
      ]
        .filter(Boolean)
        .join('\n\n')
    : [
        `MEMORY TITLE\n${title}`,
        taggedPeople.length > 0 ? `PEOPLE IN THIS MEMORY\n${taggedPeople.join(', ')}` : null,
        location ? `LOCATION\n${location}` : null,
        requiredQuotesInstruction ? requiredQuotesInstruction : null,
        verbatimQuotes
          ? `VERBATIM QUOTES — use these as direct quotes; wrap each one you use in straight double quotes "…" and attribute the speaker. These are the actual words people typed or said; preserve them exactly.\n${verbatimQuotes}`
          : null,
        claimsContext ? `WHAT PEOPLE HAVE SAID (paraphrased)\n${claimsContext}` : null,
        contributorMemoriesContext ? `CONTRIBUTOR MEMORIES\n${contributorMemoriesContext}` : null,
        wikiContent && !claimsContext ? `MEMORY WIKI\n${wikiContent.slice(0, 4000)}` : null,
      ]
        .filter(Boolean)
        .join('\n\n');

  return chat(systemPrompt, [{ role: 'user', content: context }]);
}
