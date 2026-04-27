export type PromptGroup =
  | 'Image Analysis'
  | 'Title Generation'
  | 'Snapshot Generation'
  | 'Ember AI'
  | 'Housekeeping';

export type PromptDefinition = {
  key: string;
  label: string;
  group: PromptGroup;
  description: string;
  variables: string[];
};

export const PROMPT_REGISTRY: PromptDefinition[] = [
  {
    key: 'image_analysis.initial_photo',
    label: 'Image Analysis - Initial Photo (ember image)',
    group: 'Image Analysis',
    description: 'First-time analysis of the ember’s cover photo. Drives the rich JSON returned to the wiki (people, mood, places, activities, etc.). Also reused for face detection and matching on uploaded images.',
    variables: ['schemaJson', 'originalName', 'userDescription', 'metadataSummary', 'conciseMode'],
  },
  {
    key: 'image_analysis.uploaded_photo',
    label: 'Image Analysis - Uploaded Photo (supporting media)',
    group: 'Image Analysis',
    description: 'Analysis of additional photos uploaded after the ember exists. Same shape as cover analysis but ran per attachment.',
    variables: ['schemaJson', 'originalName', 'userDescription', 'metadataSummary', 'conciseMode'],
  },

  {
    key: 'title_generation.initial',
    label: 'Title Generation - Initial',
    group: 'Title Generation',
    description: 'Generates one polished title for an ember from the analysis context.',
    variables: ['mode', 'analysisContext', 'wikiContext', 'voiceContext'],
  },
  {
    key: 'title_generation.regenerate',
    label: 'Title Generation - Regenerate',
    group: 'Title Generation',
    description: 'Generates several alternative titles in one call (used for both regular and quoted variants).',
    variables: ['mode', 'analysisContext', 'wikiContext', 'voiceContext'],
  },

  {
    key: 'snapshot_generation.initial',
    label: 'Snapshot Generation - Initial',
    group: 'Snapshot Generation',
    description: 'Generates the snapshot script the first time it is created for an ember.',
    variables: [],
  },
  {
    key: 'snapshot_generation.regenerate',
    label: 'Snapshot Generation - Regenerate',
    group: 'Snapshot Generation',
    description: 'Used when the user presses Regen Snapshot, plus other regeneration jobs (wiki structure + rewrites, caption suggestions, narration cleanup).',
    variables: [],
  },

  {
    key: 'ember_chat.style',
    label: 'Ember Chat - Style & Technique',
    group: 'Ember AI',
    description: 'Controls how the system replies in text-based chat (Ember Chat bubbles and SMS interview follow-ups). Style only — no extraction logic.',
    variables: [],
  },

  {
    key: 'ember_voice.style',
    label: 'Ember Voice - Style & Technique',
    group: 'Ember AI',
    description: 'Controls how the system replies when the user is using the in-app mic for a voice conversation. Style only — no extraction logic.',
    variables: [],
  },

  {
    key: 'ember_call.style',
    label: 'Ember Call - Style & Technique',
    group: 'Ember AI',
    description: 'Synced to Retell. Tells the Retell voice agent how to behave during outbound voice calls. Saves here are pushed to Retell automatically.',
    variables: [],
  },

  {
    key: 'x_housekeeping.memory_extract',
    label: 'Memory Extraction',
    group: 'Housekeeping',
    description: 'Background parser. After a contributor sends a chat answer, this prompt pulls structured claims (people, dates, places, facts) out of it for the wiki memory store. Not user-facing.',
    variables: [],
  },
  {
    key: 'x_housekeeping.interview_extract',
    label: 'Interview Extraction',
    group: 'Housekeeping',
    description: 'Background parser. After a Retell call ends, this prompt turns the raw transcript into a structured Q&A interview record. Not user-facing.',
    variables: ['transcript'],
  },
  {
    key: 'x_housekeeping.highlight_extract',
    label: 'Highlight Extraction',
    group: 'Housekeeping',
    description: 'Background parser. After a Retell call ends, this prompt picks the best quote-worthy moments out of the call segments. Not user-facing.',
    variables: ['imageTitle', 'contributorName', 'segmentList'],
  },
];

export const PROMPT_REGISTRY_MAP = new Map<string, PromptDefinition>(
  PROMPT_REGISTRY.map((definition) => [definition.key, definition])
);

export const APPROVED_PROMPT_KEYS = new Set<string>(
  PROMPT_REGISTRY.map((definition) => definition.key)
);

export const PROMPT_GROUPS: PromptGroup[] = [
  'Image Analysis',
  'Title Generation',
  'Snapshot Generation',
  'Ember AI',
  'Housekeeping',
];

export function getPromptDefinition(key: string): PromptDefinition | undefined {
  return PROMPT_REGISTRY_MAP.get(key);
}

export function getPromptAliasChain(key: string): string[] {
  return [key];
}
