import { chat } from '@/lib/claude';

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
  durationSeconds = 20,
  claimsContext,
  contributorMemoriesContext,
}: {
  title: string;
  location: string | null;
  taggedPeople: string[];
  selectedPeople: string[];   // empty = no person filter (use all)
  durationSeconds?: number;
  claimsContext: string;       // pre-formatted facet claims
  contributorMemoriesContext: string; // pre-formatted contributor memories
}): Promise<string> {
  const targetWords = Math.round((durationSeconds / 60) * 150);

  const peopleInstruction =
    selectedPeople.length === 0
      ? 'No specific people were selected — draw from everyone.'
      : `Focus on: ${selectedPeople.join(', ')}. Only mention others if directly relevant.`;

  const systemPrompt = `You are a warm, thoughtful narrator composing a short spoken-word story about a personal memory.

Write a single continuous narration of approximately ${targetWords} words (targeting ~${durationSeconds} seconds when read aloud at a natural pace).

Rules:
- Draw ONLY from the context provided. Do not invent details, emotions, or facts.
- If the context is thin, write a shorter, more poetic piece rather than padding.
- Write in third person unless the context strongly suggests first person.
- No headings, bullet points, or markdown — plain flowing prose only.
- Do not start with "In" or "This memory" or "This story".
- ${peopleInstruction}`;

  const context = [
    `MEMORY TITLE\n${title}`,
    taggedPeople.length > 0 ? `PEOPLE IN THIS MEMORY\n${taggedPeople.join(', ')}` : null,
    location ? `LOCATION\n${location}` : null,
    claimsContext ? `WHAT PEOPLE HAVE SAID\n${claimsContext}` : null,
    contributorMemoriesContext ? `CONTRIBUTOR MEMORIES\n${contributorMemoriesContext}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  return chat(systemPrompt, [{ role: 'user', content: context }]);
}
