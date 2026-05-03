import { PROMPT_GROUPS, type PromptGroup } from '@/lib/prompt-registry';

/** "Image Analysis" -> "image-analysis" */
export function groupSlug(group: PromptGroup): string {
  return group.toLowerCase().replace(/\s+/g, '-');
}

/** "image-analysis" -> "Image Analysis", or null if unknown */
export function groupFromSlug(slug: string): PromptGroup | null {
  return PROMPT_GROUPS.find((g) => groupSlug(g) === slug) ?? null;
}

/**
 * Compact label for the admin sidebar tree. The full registry labels
 * (e.g. "Image Analysis - Initial Photo (ember image)") are too long
 * to nest under their group. We derive a short name from the key, with
 * manual overrides for groups whose suffixes are ambiguous (e.g. all
 * Ember AI entries end in `.style`).
 */
const SHORT_PROMPT_LABEL_OVERRIDES: Record<string, string> = {
  'ember_chat.owner_style': 'Chat (Owner)',
  'ember_chat.contributor_style': 'Chat (Contributor)',
  'ember_chat.guest_style': 'Chat (Guest)',
  'ember_voice.owner_style': 'Voice (Owner)',
  'ember_voice.contributor_style': 'Voice (Contributor)',
  'ember_voice.guest_style': 'Voice (Guest)',
  'ember_call.owner_style': 'Call (Owner)',
  'ember_call.contributor_style': 'Call (Contributor)',
  'ember_sms.style': 'SMS',
  'housekeeping.why_extraction': 'Why',
  'housekeeping.emotion_extraction': 'Emotion',
  'housekeeping.extra_story_extraction': 'Extra Story',
  'housekeeping.place_extraction': 'Place',
  'housekeeping.person_extraction': 'Person',
};

export function shortPromptLabel(key: string): string {
  if (SHORT_PROMPT_LABEL_OVERRIDES[key]) return SHORT_PROMPT_LABEL_OVERRIDES[key];
  const suffix = key.split('.').slice(1).join('.') || key;
  return suffix
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
