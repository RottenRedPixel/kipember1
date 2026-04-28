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
    key: 'image_analysis.location_resolution',
    label: 'Image Analysis - Location Resolution',
    group: 'Image Analysis',
    description: 'Ranks exact address and nearby-place candidates using GPS, reverse geocoding, place search results, and visual clues from the photo.',
    variables: ['gpsCoordinates', 'reverseGeocodeAddress', 'placeCandidates', 'visualAnalysis', 'metadataSummary', 'userDescription'],
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
    description: 'Controls how the system replies in the in-app Ember Chat bubble. Receives the role of the person chatting, the chat trigger, atomic facts about the ember (title, snapshot, captured date, location, tagged people, visual scene, emotional context), and the wiki markdown — so it can decide what to ask next.',
    variables: [
      'role',
      'trigger',
      'title',
      'snapshot',
      'capturedAt',
      'location',
      'taggedPeople',
      'visualScene',
      'emotionalContext',
      'wiki',
    ],
  },

  {
    key: 'ember_sms.style',
    label: 'Ember SMS - Style & Technique',
    group: 'Ember AI',
    description: 'Controls how the system replies in SMS interview follow-ups (Twilio). Same context shape as Ember Chat but tuned for the constraints of text messages.',
    variables: ['role', 'trigger', 'title', 'snapshot'],
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
    key: 'housekeeping.why_extraction',
    label: 'Why Extraction',
    group: 'Housekeeping',
    description: 'Background parser. After any chat / SMS / voice / call message, pulls out claims about why this moment mattered (motivation, occasion, significance). Stored as MemoryClaim rows with claimType="why" and surfaced in the wiki Why section. Not user-facing.',
    variables: ['title', 'wiki', 'taggedPeople', 'contributorName', 'question', 'answer'],
  },
  {
    key: 'housekeeping.emotion_extraction',
    label: 'Emotion Extraction',
    group: 'Housekeeping',
    description: 'Background parser. After any chat / SMS / voice / call message, pulls out claims about how a tagged person felt (e.g. {subject: "Mom", value: "tired but joyful"}). Stored as MemoryClaim rows with claimType="emotion" and surfaced in the wiki Emotional state section. Not user-facing.',
    variables: ['title', 'wiki', 'taggedPeople', 'contributorName', 'question', 'answer'],
  },
  {
    key: 'housekeeping.extra_story_extraction',
    label: 'Extra Story Extraction',
    group: 'Housekeeping',
    description: 'Background parser. After any chat / SMS / voice / call message, pulls out anecdote-worthy excerpts (one or two sentences that read like a story). Stored as MemoryClaim rows with claimType="extra_story" and surfaced in the wiki Extra stories section. Not user-facing.',
    variables: ['title', 'wiki', 'taggedPeople', 'contributorName', 'question', 'answer'],
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
