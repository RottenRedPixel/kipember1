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
  selectedPeople: string[];
  durationSeconds?: number;
  claimsContext: string;
  contributorMemoriesContext: string;
  wikiContent?: string | null;
}): Promise<string> {
  const targetWords = Math.round((durationSeconds / 60) * 150);

  const peopleInstruction =
    selectedPeople.length === 0
      ? 'No specific people were selected — draw from everyone.'
      : `Focus on: ${selectedPeople.join(', ')}. Only mention others if directly relevant.`;

  // No fallback — prompt must be in DB
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
