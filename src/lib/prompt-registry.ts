export type PromptGroup =
  | 'Image Analysis'
  | 'Title Generation'
  | 'Snapshot Generation'
  | 'Wiki'
  | 'Captions'
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
    description: 'Generates one polished title for an ember at creation time. Receives `mode` (always "single" here), `analysisContext`, `humanContext`, `quoteEntries`, `fullContext`, `peopleInstruction` (everyone tagged in the photo), `preferredPeopleInstruction` (always empty on initial — the user has not picked yet), and `optionalTaggedPeopleInstruction` (everyone tagged, since none are preferred yet).',
    variables: ['mode', 'analysisContext', 'humanContext', 'quoteEntries', 'fullContext', 'peopleInstruction', 'preferredPeopleInstruction', 'optionalTaggedPeopleInstruction'],
  },
  {
    key: 'title_generation.regenerate',
    label: 'Title Generation - Regenerate',
    group: 'Title Generation',
    description: 'Fires when the user opens the Title slider in Tend, checks people to prefer, and presses Regen Ideas. Generates three alternative titles per mode (analysis, context, quoted). Receives `mode`, `analysisContext`, `humanContext`, `quoteEntries`, `fullContext`, `peopleInstruction` (everyone tagged in the photo), `preferredPeopleInstruction` (the subset of tagged people the user explicitly checked — should be favored when natural), and `optionalTaggedPeopleInstruction` (tagged people the user did not check — may inform context but should not be forced).',
    variables: ['mode', 'analysisContext', 'humanContext', 'quoteEntries', 'fullContext', 'peopleInstruction', 'preferredPeopleInstruction', 'optionalTaggedPeopleInstruction'],
  },

  {
    key: 'snapshot_generation.initial',
    label: 'Snapshot Generation - Initial',
    group: 'Snapshot Generation',
    description: 'Fires automatically when an ember is first created (after image analysis + wiki generation). Should pull from the wiki, image analysis, location, and tagged people to produce a short ~5-second opener (~12 words). Receives `targetWords`, `durationSeconds`, and `peopleInstruction`. Wiki content, image summary, location, and contributor memories are appended to the user message.',
    variables: ['targetWords', 'durationSeconds', 'peopleInstruction'],
  },
  {
    key: 'snapshot_generation.regenerate',
    label: 'Snapshot Generation - Regenerate',
    group: 'Snapshot Generation',
    description: 'Fires when the user opens the Snapshot slider in Tend, sets the controllers (length, required people), and presses Regen Snapshot. Receives `targetWords` (computed from the slider), `durationSeconds`, `peopleInstruction` (everyone tagged in the photo), `requiredPeopleInstruction` (the subset of tagged people the user explicitly checked — must be named), and `optionalTaggedPeopleInstruction` (tagged people the user did not check — may be named for context but not required).',
    variables: ['targetWords', 'durationSeconds', 'peopleInstruction', 'requiredPeopleInstruction', 'optionalTaggedPeopleInstruction'],
  },

  {
    key: 'wiki.structure',
    label: 'Wiki - Structure (JSON)',
    group: 'Wiki',
    description: 'System prompt for building the structured memory JSON object that backs the wiki. Receives no template variables — the evidence packet is sent as the user message.',
    variables: [],
  },
  {
    key: 'wiki.rewrite',
    label: 'Wiki - Rewrite (Markdown)',
    group: 'Wiki',
    description: 'System prompt for rendering the structured memory JSON into the wiki markdown the user reads. Receives no template variables — the structured JSON is sent as the user message.',
    variables: [],
  },

  {
    key: 'caption_generation.suggestions',
    label: 'Captions - Suggestions',
    group: 'Captions',
    description: 'System prompt for generating caption suggestions for an ember. Receives `voiceStyle` and `voiceInstruction`.',
    variables: ['voiceStyle', 'voiceInstruction'],
  },

  {
    key: 'ember_chat.style',
    label: 'Ember Chat - Style & Technique',
    group: 'Ember AI',
    description: 'Controls how the system replies in the in-app Ember Chat bubble. Receives the role, trigger, atomic facts (title, snapshot, captured date, location, tagged people, visual scene, emotional context), the full wiki markdown, and a heuristic interview coverage signal (answered/unanswered topics across who/when/where/what/why/how + next topic to probe). The reply should always read the wiki first, reference what is already known when probing, and naturally pursue the next unanswered topic so housekeeping has something fresh to extract.',
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
      'answeredTopics',
      'unansweredTopics',
      'nextTopic',
      'interviewProgress',
    ],
  },

  {
    key: 'ember_chat.guest_style',
    label: 'Ember Chat (Guest) - Style & Technique',
    group: 'Ember AI',
    description: 'Used for guest viewers who arrived via a share link. Same context shape as Ember Chat. Guests do not contribute, so this prompt should answer questions about the memory using the wiki and avoid probing for unanswered topics. No follow-up questions back at the guest.',
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
      'answeredTopics',
      'unansweredTopics',
      'nextTopic',
      'interviewProgress',
    ],
  },

  {
    key: 'ember_voice.style',
    label: 'Ember Voice - Style & Technique',
    group: 'Ember AI',
    description: 'Controls how the system replies when the user is using the in-app mic for a voice conversation. Receives the role, the live transcript, the same atomic facts and wiki markdown as Ember Chat, plus the same interview coverage signal (answered/unanswered topics + next topic). Spoken replies should reference what the wiki already establishes and pursue gaps naturally rather than repeating known facts.',
    variables: [
      'role',
      'trigger',
      'transcript',
      'title',
      'snapshot',
      'capturedAt',
      'location',
      'taggedPeople',
      'visualScene',
      'emotionalContext',
      'wiki',
      'answeredTopics',
      'unansweredTopics',
      'nextTopic',
      'interviewProgress',
    ],
  },

  {
    key: 'ember_voice.guest_style',
    label: 'Ember Voice (Guest) - Style & Technique',
    group: 'Ember AI',
    description: 'Used for guest viewers using the in-app mic. Same context shape as Ember Voice. Spoken replies should answer questions about the memory using the wiki and avoid probing the guest. Guests do not contribute, so do not push interview-style follow-ups.',
    variables: [
      'role',
      'trigger',
      'transcript',
      'title',
      'snapshot',
      'capturedAt',
      'location',
      'taggedPeople',
      'visualScene',
      'emotionalContext',
      'wiki',
      'answeredTopics',
      'unansweredTopics',
      'nextTopic',
      'interviewProgress',
    ],
  },

  {
    key: 'ember_call.style',
    label: 'Ember Call - Style & Technique',
    group: 'Ember AI',
    description: 'Synced to Retell. Tells the Retell voice agent how to behave during outbound voice calls. The agent runs with a static system prompt (no per-call variable injection here yet), so this prompt should instruct it to open by saying what the wiki already knows about the moment, then naturally pursue who / when / where / what / why / how gaps. Live wiki context is delivered to Retell at call setup time. Saves here are pushed to Retell automatically.',
    variables: [],
  },

  {
    key: 'ember_sms.style',
    label: 'Ember SMS - Style & Technique',
    group: 'Ember AI',
    description: 'Controls how the system replies in SMS interview follow-ups (Twilio). Same context shape as Ember Chat but tuned for the constraints of text messages.',
    variables: ['role', 'trigger', 'title', 'snapshot'],
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

  {
    key: 'housekeeping.place_extraction',
    label: 'Place Extraction',
    group: 'Housekeeping',
    description: 'Background parser. After any chat / SMS / voice / call message, pulls out place mentions (named venues, neighborhoods, cities, landmarks, addresses) so they can be reconciled against the photo GPS / confirmed location later. Stored as MemoryClaim rows with claimType="place". Not currently user-facing — feeds future conflict resolution.',
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
  'Wiki',
  'Captions',
  'Ember AI',
  'Housekeeping',
];

export function getPromptDefinition(key: string): PromptDefinition | undefined {
  return PROMPT_REGISTRY_MAP.get(key);
}

export function getPromptAliasChain(key: string): string[] {
  return [key];
}
