export type PromptGroup =
  | 'Image Analysis'
  | 'Titles'
  | 'Wiki & Snapshot'
  | 'Chat & Memory'
  | 'Voice'
  | 'Voice Call (Retell)'
  | 'Face Matching';

export type PromptDefinition = {
  key: string;
  label: string;
  group: PromptGroup;
  description: string;
  variables: string[];
  aliasFrom?: string;
};

export const PROMPT_REGISTRY: PromptDefinition[] = [
  {
    key: 'image_analysis.initial_photo',
    label: 'Cover image analysis',
    group: 'Image Analysis',
    description: 'First-time analysis of the ember’s cover photo. Drives the rich JSON returned to the wiki (people, mood, places, activities, etc.).',
    variables: ['schemaJson', 'originalName', 'userDescription', 'metadataSummary', 'conciseMode'],
  },
  {
    key: 'image_analysis.uploaded_photo',
    label: 'Attachment image analysis',
    group: 'Image Analysis',
    description: 'Analysis of additional photos uploaded after the ember exists. Same shape as cover analysis but ran per attachment.',
    variables: ['schemaJson', 'originalName', 'userDescription', 'metadataSummary', 'conciseMode'],
  },

  {
    key: 'title_generation.initial',
    label: 'Title — single suggestion',
    group: 'Titles',
    description: 'Generates one polished title for an ember from analysis context.',
    variables: ['mode', 'analysisContext', 'wikiContext', 'voiceContext'],
  },
  {
    key: 'title_generation.regenerate',
    label: 'Title — batch suggestions',
    group: 'Titles',
    description: 'Generates several alternative titles in one call (used for both regular and quoted variants).',
    variables: ['mode', 'analysisContext', 'wikiContext', 'voiceContext'],
  },

  {
    key: 'snapshot_generation.initial',
    label: 'Wiki structure',
    group: 'Wiki & Snapshot',
    description: 'Builds the structured outline that backs the wiki view (sections, headings, ordering). Runs once when the wiki is first generated.',
    variables: [],
  },
  {
    key: 'wiki.rewrite',
    label: 'Wiki rewrite',
    group: 'Wiki & Snapshot',
    description: 'Rewrites the long-form wiki content from accumulated context. Triggered when contributors add new memories.',
    variables: [],
    aliasFrom: 'snapshot_generation.regenerate',
  },
  {
    key: 'wiki.follow_up_questions',
    label: 'Wiki follow-up questions',
    group: 'Wiki & Snapshot',
    description: 'Generates the follow-up questions shown to contributors based on what is already in the wiki.',
    variables: [],
    aliasFrom: 'ember_chat.style',
  },
  {
    key: 'snapshot.script',
    label: 'Snapshot script',
    group: 'Wiki & Snapshot',
    description: 'Writes the trailer-style snapshot script (voice + media blocks) used for playback.',
    variables: ['stylePrompt', 'storyContext', 'storyTitle', 'durationSeconds', 'wordCount', 'storyFocus', 'ownerFirstName', 'selectedContributors', 'includeEmberVoice', 'emberVoiceLabel', 'targetWords', 'peopleInstruction', 'requiredPeopleInstruction'],
    aliasFrom: 'snapshot_generation.regenerate',
  },
  {
    key: 'caption.suggest',
    label: 'Caption suggestions',
    group: 'Wiki & Snapshot',
    description: 'Suggests short captions for shared posts based on ember context and selected voice style.',
    variables: ['voiceStyle', 'voiceInstruction', 'analysisContext', 'wikiContext'],
    aliasFrom: 'snapshot_generation.regenerate',
  },
  {
    key: 'narration.cleanup',
    label: 'Narration cleanup',
    group: 'Wiki & Snapshot',
    description: 'Cleans up the snapshot script before sending to TTS — strips markdown noise, fixes pronunciation hints.',
    variables: [],
    aliasFrom: 'snapshot_generation.regenerate',
  },

  {
    key: 'ember_chat.reply',
    label: 'Ember chat reply',
    group: 'Chat & Memory',
    description: 'The main Ember chat reply persona used in the wiki chat panel. This is the most-edited prompt for tuning conversational flow.',
    variables: [],
    aliasFrom: 'ember_chat.style',
  },
  {
    key: 'memory.extract_claims',
    label: 'Memory claim extraction',
    group: 'Chat & Memory',
    description: 'Extracts structured memory claims from a contributor’s chat or voice transcript so they can be reconciled into the wiki.',
    variables: [],
    aliasFrom: 'ember_chat.style',
  },

  {
    key: 'ember_voice.reply',
    label: 'Ember voice reply',
    group: 'Voice',
    description: 'Persona for Ember’s spoken replies during a live voice session.',
    variables: [],
    aliasFrom: 'ember_voice.style',
  },
  {
    key: 'voice.extract_interview',
    label: 'Voice call — interview extraction',
    group: 'Voice',
    description: 'Extracts a structured interview record (questions + answers) from a completed voice call transcript.',
    variables: [],
    aliasFrom: 'ember_voice.style',
  },
  {
    key: 'voice.extract_clips',
    label: 'Voice call — clip extraction',
    group: 'Voice',
    description: 'Picks the most quotable highlight clips from a voice call transcript for inclusion in snapshots.',
    variables: ['task', 'imageTitle'],
    aliasFrom: 'ember_voice.style',
  },

  {
    key: 'ember_call.style',
    label: 'Retell call — main prompt',
    group: 'Voice Call (Retell)',
    description: 'Main system prompt for the Retell voice agent. Synced to Retell by scripts/sync-retell-memory-agent.mjs at deploy time, not at request time — edits here only take effect after running that script against the control plane.',
    variables: [],
  },
  {
    key: 'ember_call.closing',
    label: 'Retell call — closing prompt',
    group: 'Voice Call (Retell)',
    description: 'Closing prompt for the Retell voice agent. Synced to Retell by scripts/sync-retell-memory-agent.mjs at deploy time.',
    variables: [],
  },

  {
    key: 'face_match.detect',
    label: 'Face detection',
    group: 'Face Matching',
    description: 'Detects faces in an uploaded image — returns bounding boxes and basic descriptors. Used by detect-faces and auto-tag.',
    variables: ['task', 'schemaJson'],
    aliasFrom: 'image_analysis.initial_photo',
  },
  {
    key: 'face_match.match',
    label: 'Face matching',
    group: 'Face Matching',
    description: 'Compares a detected face against a candidate pool of known people. Drives the suggestion list when tagging.',
    variables: ['task', 'schemaJson'],
    aliasFrom: 'image_analysis.initial_photo',
  },
  {
    key: 'face_match.repair_json',
    label: 'Face matching JSON repair',
    group: 'Face Matching',
    description: 'Recovers structured output when the face-match model returns malformed JSON. Rarely needs tuning.',
    variables: ['task', 'schemaJson'],
    aliasFrom: 'image_analysis.initial_photo',
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
  'Titles',
  'Wiki & Snapshot',
  'Chat & Memory',
  'Voice',
  'Voice Call (Retell)',
  'Face Matching',
];

export function getPromptDefinition(key: string): PromptDefinition | undefined {
  return PROMPT_REGISTRY_MAP.get(key);
}

export function getPromptAliasChain(key: string): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = key;

  while (current) {
    if (seen.has(current)) {
      break;
    }
    seen.add(current);
    chain.push(current);
    const definition = PROMPT_REGISTRY_MAP.get(current);
    current = definition?.aliasFrom;
  }

  return chain;
}
