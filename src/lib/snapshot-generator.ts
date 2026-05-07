import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';

/**
 * Generate the narration script for an Ember's Snapshot.
 *
 * The Snapshot is the short (~30s) AI-summarized memory used by the play
 * overlay. This function takes the assembled memory context (title, photo
 * summary, wiki, contributor memories, voice-call data) and returns the
 * spoken script. The script is then stored on the `Snapshot` Prisma model
 * and rendered to audio by /api/images/[id]/snapshot-audio.
 */
export async function generateSnapshotScript({
  title,
  summary,
  location,
  durationSeconds = 30,
  taggedPeople = [],
  requiredPeople = [],
  wikiContent = null,
  contributorMemories = [],
  callSummaries = [],
  callHighlights = [],
  promptKey = 'snapshot_generation.regenerate',
}: {
  title: string;
  summary: string | null;
  location: string | null;
  durationSeconds?: number;
  taggedPeople?: string[];
  requiredPeople?: string[];
  wikiContent?: string | null;
  contributorMemories?: Array<{ contributorName: string; answer: string }>;
  callSummaries?: Array<{ contributorName: string; summary: string }>;
  callHighlights?: Array<{ contributorName: string; title: string; quote: string }>;
  promptKey?: string;
}): Promise<string> {
  const targetWords = Math.round((durationSeconds / 60) * 150);
  const requiredPeopleSet = new Set(requiredPeople);
  const optionalTaggedPeople = taggedPeople.filter((person) => !requiredPeopleSet.has(person));

  const allSelected = requiredPeople.length === taggedPeople.length && taggedPeople.length > 0;
  const noneSelected = requiredPeople.length === 0;

  const peopleHint = noneSelected
    ? 'No names selected — do NOT include any person\'s name in the narration.'
    : allSelected
      ? `All names selected — you MUST include ALL of these names in the narration: ${requiredPeople.join(', ')}`
      : `Only these names selected — include ONLY these names, no others: ${requiredPeople.join(', ')}`;

  const context = [
    `MEMORY TITLE\n${title}`,
    taggedPeople.length > 0
      ? `PEOPLE IN THIS PHOTO\n${taggedPeople.join(', ')}`
      : null,
    location ? `LOCATION\n${location}` : null,
    summary ? `WHAT THE IMAGE SHOWS\n${summary}` : null,
    wikiContent ? `MEMORY WIKI\n${wikiContent.slice(0, 6000)}` : null,
    contributorMemories.length > 0
      ? `CONTRIBUTOR MEMORIES\n${contributorMemories.map((m) => `${m.contributorName}: ${m.answer}`).join('\n')}`
      : null,
    callSummaries.length > 0
      ? `VOICE CALL SUMMARIES\n${callSummaries.map((c) => `${c.contributorName}: ${c.summary}`).join('\n')}`
      : null,
    callHighlights.length > 0
      ? `VOICE CALL HIGHLIGHTS\n${callHighlights.map((h) => `${h.contributorName} — ${h.title}: "${h.quote}"`).join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const systemPrompt = await renderPromptTemplate(promptKey, '', {
    targetWords,
    durationSeconds,
    peopleInstruction: taggedPeople.join(', '),
    requiredPeopleInstruction: requiredPeople.join(', '),
    optionalTaggedPeopleInstruction: optionalTaggedPeople.join(', '),
    peopleHint,
  });

  return chat(systemPrompt, [
    { role: 'user', content: context },
  ]);
}
