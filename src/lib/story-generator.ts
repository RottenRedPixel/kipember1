import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';

/**
 * Generate a short narration script for a facet-composed Story.
 *
 * Unlike the Snapshot (which is a comprehensive summary of the whole ember),
 * a Story is composed on-demand from a specific subset of facets the user
 * selected in StoriesSheet — e.g. "Mary + feelings" or "place + why".
 * The LLM only narrates what those facets contain; if a facet has no material
 * it should not be in the context at all.
 */
export async function generateStoryScript({
  title,
  location,
  taggedPeople,
  selectedPeople,
  durationSeconds = 7,
  claimsContext,
  contributorMemoriesContext,
  wikiContent = null,
}: {
  title: string;
  location: string | null;
  taggedPeople: string[];
  selectedPeople: string[];   // empty = no person filter (use all)
  durationSeconds?: number;
  claimsContext: string;       // pre-formatted facet claims
  contributorMemoriesContext: string; // pre-formatted contributor memories
  wikiContent?: string | null; // fallback when no specific claims matched
}): Promise<string> {
  const targetWords = Math.round((durationSeconds / 60) * 150);

  const peopleInstruction =
    selectedPeople.length === 0
      ? 'No specific people were selected — draw from everyone.'
      : `Focus on: ${selectedPeople.join(', ')}. Only mention others if directly relevant.`;

  const systemPrompt = await renderPromptTemplate('story_generation.compose', '', {
    targetWords,
    durationSeconds,
    peopleInstruction,
  });

  const context = [
    `MEMORY TITLE\n${title}`,
    taggedPeople.length > 0 ? `PEOPLE IN THIS MEMORY\n${taggedPeople.join(', ')}` : null,
    location ? `LOCATION\n${location}` : null,
    claimsContext ? `WHAT PEOPLE HAVE SAID\n${claimsContext}` : null,
    contributorMemoriesContext ? `CONTRIBUTOR MEMORIES\n${contributorMemoriesContext}` : null,
    wikiContent && !claimsContext ? `MEMORY WIKI\n${wikiContent.slice(0, 4000)}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  return chat(systemPrompt, [{ role: 'user', content: context }]);
}
