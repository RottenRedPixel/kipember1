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

  const PLAYLIST_PROMPT_FALLBACK = `You are Ember — a warm, personal narrator telling a short audio memory story.

You will receive a memory title, optional location, optional context, and a numbered list of real voice clips from contributors.

Your job: write ONE short intro sentence before each clip that sets context and leads naturally into what the contributor is about to say. Do NOT quote or paraphrase the clip — just introduce it.

Good examples:
- "They were surprised by how long it took. In Amado's words:"
- "The moment stayed with her. As Maria described it:"
- "It wasn't what they expected, and Amado put it plainly:"

Rules:
- Each narration segment: 1–2 sentences max
- Never repeat or echo the clip content
- Warm, third-person, conversational tone
- Total narration ≈ {{targetWords}} words across all segments
- You have {{clipCount}} clips to introduce

Return ONLY valid JSON:
{
  "segments": [
    { "type": "narration", "text": "..." },
    { "type": "clip", "index": 0 },
    { "type": "narration", "text": "..." },
    { "type": "clip", "index": 1 }
  ]
}`;

  const systemPrompt = await renderPromptTemplate(
    'story_generation.playlist',
    PLAYLIST_PROMPT_FALLBACK,
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

  let raw: string;
  try {
    raw = await chat(systemPrompt, [{ role: 'user', content: context }]);
  } catch {
    return [];
  }

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
    // Fallback: treat the whole response as a single narration segment
    return raw.trim() ? [{ type: 'narration', text: raw.trim() }] : [];
  }
}

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
