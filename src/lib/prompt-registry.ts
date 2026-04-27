export type PromptGroup =
  | 'Image Analysis'
  | 'Title Generation'
  | 'Snapshot Generation'
  | 'Ember AI';

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
    description: 'One prompt that handles all in-app chat flows: the live Ember Chat reply, memory-claim extraction from chat, and wiki follow-up questions.',
    variables: [],
  },

  {
    key: 'ember_voice.style',
    label: 'Ember Voice - Style & Technique',
    group: 'Ember AI',
    description: 'One prompt that handles in-app voice chats: spoken Ember replies, transcript-to-interview extraction, and highlight-clip extraction.',
    variables: [],
  },

  {
    key: 'ember_call.style',
    label: 'Ember Call - Style & Technique',
    group: 'Ember AI',
    description: 'Synced to Retell. Tells the Retell voice agent how to behave during outbound voice calls. Saves here are pushed to Retell automatically.',
    variables: [],
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
];

export function getPromptDefinition(key: string): PromptDefinition | undefined {
  return PROMPT_REGISTRY_MAP.get(key);
}

export function getPromptAliasChain(key: string): string[] {
  return [key];
}
