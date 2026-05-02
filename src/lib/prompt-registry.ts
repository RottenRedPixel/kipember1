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
  /** Plain-English summary of what this prompt does. */
  whatItDoes: string;
  /** Each item is a single trigger condition or call site. */
  whenItFires: string[];
  /**
   * Each item names a surface and whether editing this prompt affects it.
   * Use `on: true` for "yes, this controls that surface" and
   * `on: false` for "looks related but actually controlled elsewhere"
   * (helpful for disambiguation).
   */
  affects: Array<{ label: string; on: boolean }>;
};

export const PROMPT_REGISTRY: PromptDefinition[] = [
  {
    key: 'image_analysis.initial_photo',
    label: 'Image Analysis - Initial Photo (ember image)',
    group: 'Image Analysis',
    description: 'First-time analysis of the ember’s cover photo. Drives the rich JSON returned to the wiki (people, mood, places, activities, etc.). Also reused for face detection and matching on uploaded images.',
    variables: ['schemaJson', 'originalName', 'userDescription', 'metadataSummary', 'conciseMode'],
    whatItDoes:
      'Tells Claude how to look at the cover photo of a brand-new ember and return a structured JSON description: people in the frame, mood, location type, activities, visual details, etc. The schema embedded in the prompt forces a consistent shape so the wiki, snapshot, and title all have reliable data to draw from.',
    whenItFires: [
      'A user uploads a new photo or video to create an ember',
      'Image analysis is rerun on demand from the Tend slider',
    ],
    affects: [
      { label: 'The Image Analysis section of every ember wiki', on: true },
      { label: 'Title and snapshot generation (they read this analysis as input)', on: true },
      { label: 'Face detection results (this prompt is overloaded with task=face_detect)', on: true },
      { label: 'Per-attachment analysis (uses image_analysis.uploaded_photo instead)', on: false },
    ],
  },
  {
    key: 'image_analysis.uploaded_photo',
    label: 'Image Analysis - Uploaded Photo (supporting media)',
    group: 'Image Analysis',
    description: 'Analysis of additional photos uploaded after the ember exists. Same shape as cover analysis but ran per attachment.',
    variables: ['schemaJson', 'originalName', 'userDescription', 'metadataSummary', 'conciseMode'],
    whatItDoes:
      'Same task as the cover-photo analysis but for supporting media that gets attached AFTER the ember exists. Returns the same structured JSON. Kept separate so the cover-photo prompt can be tuned more aggressively without affecting bulk attachment processing.',
    whenItFires: [
      'A user uploads a supporting photo or video to an existing ember (Add Content)',
    ],
    affects: [
      { label: 'The "Supporting Media" / per-attachment analysis blocks in the wiki', on: true },
      { label: 'Cover-photo analysis (uses image_analysis.initial_photo)', on: false },
    ],
  },
  {
    key: 'image_analysis.location_resolution',
    label: 'Image Analysis - Location Resolution',
    group: 'Image Analysis',
    description: 'Ranks exact address and nearby-place candidates using GPS, reverse geocoding, place search results, and visual clues from the photo.',
    variables: ['gpsCoordinates', 'reverseGeocodeAddress', 'placeCandidates', 'visualAnalysis', 'metadataSummary', 'userDescription'],
    whatItDoes:
      'When a photo has GPS coordinates, this prompt asks Claude to combine the raw lat/lng, the reverse-geocoded address, nearby place search results, and visual cues from the photo to pick the most likely actual location. Outputs a ranked list of suggestions for the Edit Place slider.',
    whenItFires: [
      'A user opens the Edit Place slider on an ember whose photo has GPS metadata',
    ],
    affects: [
      { label: 'Place suggestions in the Edit Place slider', on: true },
      { label: 'The Geolocation block in the wiki (only after the user confirms a suggestion)', on: false },
    ],
  },

  {
    key: 'title_generation.initial',
    label: 'Title Generation - Initial',
    group: 'Title Generation',
    description: 'Generates one polished title for an ember at creation time. Receives `mode` (always "single" here), `analysisContext`, `humanContext`, `quoteEntries`, `fullContext`, `peopleInstruction` (everyone tagged in the photo), `preferredPeopleInstruction` (always empty on initial — the user has not picked yet), and `optionalTaggedPeopleInstruction` (everyone tagged, since none are preferred yet).',
    variables: ['mode', 'analysisContext', 'humanContext', 'quoteEntries', 'fullContext', 'peopleInstruction', 'preferredPeopleInstruction', 'optionalTaggedPeopleInstruction'],
    whatItDoes:
      'Generates the initial title that auto-fills when an ember is first created. Reads the photo analysis, any contributor memories collected so far, and tagged people, and returns one short title (typically 3-7 words). The user can keep it or open the Title slider to regenerate.',
    whenItFires: [
      'An ember is just created and needs a starting title before the wiki renders',
    ],
    affects: [
      { label: 'The default title shown after upload (and stored on Image.title)', on: true },
      { label: 'Regenerated title ideas after the user clicks Regen Ideas (uses title_generation.regenerate)', on: false },
    ],
  },
  {
    key: 'title_generation.regenerate',
    label: 'Title Generation - Regenerate',
    group: 'Title Generation',
    description: 'Fires when the user opens the Title slider in Tend, checks people to prefer, and presses Regen Ideas. Generates three alternative titles per mode (analysis, context, quoted). Receives `mode`, `analysisContext`, `humanContext`, `quoteEntries`, `fullContext`, `peopleInstruction` (everyone tagged in the photo), `preferredPeopleInstruction` (the subset of tagged people the user explicitly checked — should be favored when natural), and `optionalTaggedPeopleInstruction` (tagged people the user did not check — may inform context but should not be forced).',
    variables: ['mode', 'analysisContext', 'humanContext', 'quoteEntries', 'fullContext', 'peopleInstruction', 'preferredPeopleInstruction', 'optionalTaggedPeopleInstruction'],
    whatItDoes:
      'Generates a batch of alternate title ideas when the user opens the Title slider in Tend and presses Regen Ideas. Returns three flavors: analysis-driven, context-driven, and quote-driven. Honors which tagged people the user has explicitly preferred so the suggestions feature them.',
    whenItFires: [
      'User opens the Edit Title slider, optionally checks people to prefer, and presses Regen Ideas',
    ],
    affects: [
      { label: 'The list of title suggestions shown in the Title slider', on: true },
      { label: 'The first auto-generated title at creation time (uses title_generation.initial)', on: false },
    ],
  },

  {
    key: 'snapshot_generation.initial',
    label: 'Snapshot Generation - Initial',
    group: 'Snapshot Generation',
    description: 'Fires automatically when an ember is first created (after image analysis + wiki generation). Should pull from the wiki, image analysis, location, and tagged people to produce a short ~5-second opener (~12 words). Receives `targetWords`, `durationSeconds`, and `peopleInstruction`. Wiki content, image summary, location, and contributor memories are appended to the user message.',
    variables: ['targetWords', 'durationSeconds', 'peopleInstruction'],
    whatItDoes:
      'Generates the very short narration script that the play button speaks aloud — typically a ~5 second opener. The first time an ember is created, this prompt auto-fires once the wiki and analysis are ready, so the play overlay has something to say from day one.',
    whenItFires: [
      'An ember is created and the snapshot has not been generated yet',
    ],
    affects: [
      { label: 'The default Snapshot script and what the play button speaks', on: true },
      { label: 'The Story Snapshot block in the wiki', on: true },
      { label: 'Regenerated snapshots from the slider (uses snapshot_generation.regenerate)', on: false },
    ],
  },
  {
    key: 'snapshot_generation.regenerate',
    label: 'Snapshot Generation - Regenerate',
    group: 'Snapshot Generation',
    description: 'Fires when the user opens the Snapshot slider in Tend, sets the controllers (length, required people), and presses Regen Snapshot. Receives `targetWords` (computed from the slider), `durationSeconds`, `peopleInstruction` (everyone tagged in the photo), `requiredPeopleInstruction` (the subset of tagged people the user explicitly checked — must be named), and `optionalTaggedPeopleInstruction` (tagged people the user did not check — may be named for context but not required).',
    variables: ['targetWords', 'durationSeconds', 'peopleInstruction', 'requiredPeopleInstruction', 'optionalTaggedPeopleInstruction'],
    whatItDoes:
      'Generates a fresh snapshot script when the user opens the Edit Snapshot slider, adjusts length / required people, and presses Regen. Honors which people MUST be named (required) vs which are optional context. Replaces the existing snapshot on save.',
    whenItFires: [
      'User opens Edit Snapshot in Tend and presses Regen Snapshot',
    ],
    affects: [
      { label: 'The updated Snapshot script and play-button audio', on: true },
      { label: 'The Story Snapshot block in the wiki', on: true },
      { label: 'The first auto-generated snapshot at creation time (uses snapshot_generation.initial)', on: false },
    ],
  },

  {
    key: 'wiki.structure',
    label: 'Wiki - Structure (JSON)',
    group: 'Wiki',
    description: 'System prompt for building the structured memory JSON object that backs the wiki. Receives no template variables — the evidence packet is sent as the user message.',
    variables: [],
    whatItDoes:
      'Pass 1 of the wiki pipeline. Takes the evidence packet (analysis + tags + voice-call clips + chat messages + claims) and asks Claude to organize it into a structured JSON memory model. This JSON is the data backbone — it gets handed to wiki.rewrite next to become readable markdown.',
    whenItFires: [
      'Whenever something content-relevant changes: a tag is added, a voice call finishes, an attachment lands, a memory claim is written, an admin clicks regenerate.',
    ],
    affects: [
      { label: 'The intermediate JSON the wiki is built from (not user-visible directly)', on: true },
      { label: 'Indirectly — the entire wiki you read in Tend > View Wiki', on: true },
      { label: 'The deterministic wiki sections built by lib/wiki-generator.ts (those don’t go through Claude)', on: false },
    ],
  },
  {
    key: 'wiki.rewrite',
    label: 'Wiki - Rewrite (Markdown)',
    group: 'Wiki',
    description: 'System prompt for rendering the structured memory JSON into the wiki markdown the user reads. Receives no template variables — the structured JSON is sent as the user message.',
    variables: [],
    whatItDoes:
      'Pass 2 of the wiki pipeline. Takes the structured JSON from wiki.structure and renders it into the readable markdown that fills the View Wiki slider. Tunes voice, prose, section ordering, and how much detail to show vs. omit.',
    whenItFires: [
      'Always runs immediately after wiki.structure as a second Claude call',
    ],
    affects: [
      { label: 'The narrative tone and prose of the wiki body the user reads', on: true },
      { label: 'Section ordering and headings within the wiki', on: true },
      { label: 'The deterministic wiki sections built by lib/wiki-generator.ts (those don’t go through Claude)', on: false },
    ],
  },

  {
    key: 'caption_generation.suggestions',
    label: 'Captions - Suggestions',
    group: 'Captions',
    description: 'System prompt for generating caption suggestions for an ember. Receives `voiceStyle` and `voiceInstruction`.',
    variables: ['voiceStyle', 'voiceInstruction'],
    whatItDoes:
      'When the user asks for caption ideas for an ember, this prompt generates a small set of suggestions in the requested voice style (e.g. "warm and personal" vs "punchy social-media one-liner"). Used to seed the user’s short ember description.',
    whenItFires: [
      'User opens an ember’s caption helper and requests suggestions',
    ],
    affects: [
      { label: 'The list of caption suggestions returned to the UI', on: true },
      { label: 'The actual caption stored on the ember (only after the user picks one)', on: false },
    ],
  },

  {
    key: 'ember_chat.style',
    label: 'Ember Chat - Style & Technique',
    group: 'Ember AI',
    description: 'Controls how the system replies in the in-app Ember Chat bubble. Receives the role, trigger, atomic facts (title, snapshot, captured date, location, tagged people, visual scene, emotional context), the full wiki markdown, and a heuristic interview coverage signal (answered/unanswered topics across who/when/where/what/why/how + next topic to probe). On the welcome triggers (welcome_first_open / welcome_returning) it also receives `userFirstName` (greeting target — falls back to "there" when blank) and `isFirstEmber` (the string "true" or "false" — true when this is the user\'s first-ever owned ember). The reply should always read the wiki first, reference what is already known when probing, and naturally pursue the next unanswered topic so housekeeping has something fresh to extract.',
    variables: [
      'role',
      'trigger',
      'userFirstName',
      'isFirstEmber',
      'title',
      'snapshot',
      'capturedAt',
      'location',
      'taggedPeople',
      'visualScene',
      'emotionalContext',
      'claims',
      'wiki',
      'answeredTopics',
      'unansweredTopics',
      'nextTopic',
      'interviewProgress',
    ],
    whatItDoes:
      'Drives every text reply Ember sends inside the chat bubble at the bottom of an ember view. Sets the persona (warm, attentive guide), the greeting rule ("Hi {firstName}"), response shape (1-3 sentences, one question, no markdown), and the rule that the AI must consult the wiki and tagged-people list before asking who/where someone is.',
    whenItFires: [
      'User opens chat on an ember for the first time → trigger "welcome_first_open"',
      'User opens chat on an ember they have used before → "welcome_returning"',
      'User sends a typed message in chat → "message"',
      'User uploads a photo into the chat thread → "photo_upload"',
      'User uploads a video into the chat thread → "video_upload"',
      'A follow-up turn after a previous AI question → "followup"',
    ],
    affects: [
      { label: 'Ember Chat (the chat bubble in /ember/[id])', on: true },
      { label: 'Ember Voice — uses ember_voice.style instead', on: false },
      { label: 'Ember Call — uses ember_call.style (Retell)', on: false },
      { label: 'Ember SMS — uses ember_sms.style', on: false },
      { label: 'Guest viewers via share link — use ember_chat.guest_style', on: false },
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
      'claims',
      'wiki',
      'answeredTopics',
      'unansweredTopics',
      'nextTopic',
      'interviewProgress',
    ],
    whatItDoes:
      'Same context as Ember Chat, but tuned for unauthenticated guests viewing via a share link. The guest is here to hear about the memory, not to contribute to it — so this prompt answers their questions from the wiki and explicitly does NOT probe them with interview-style follow-ups.',
    whenItFires: [
      'A non-logged-in user follows a share link to /guest/[token] and uses the chat',
    ],
    affects: [
      { label: 'Chat replies to anyone visiting via /guest/[token]', on: true },
      { label: 'Chat replies to the owner or any logged-in contributor (uses ember_chat.style)', on: false },
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
    whatItDoes:
      'Drives Ember’s replies when the user is talking through the in-app microphone. Same memory context as the chat surface, but tuned for voice — shorter sentences, conversational rhythm, easier to say out loud than to read.',
    whenItFires: [
      'User taps the Voice tab in the Ember Chat bar and speaks',
    ],
    affects: [
      { label: 'In-app voice replies for owners and logged-in contributors', on: true },
      { label: 'Text chat replies (uses ember_chat.style)', on: false },
      { label: 'Phone calls via Retell (uses ember_call.style)', on: false },
      { label: 'Guests using voice (uses ember_voice.guest_style)', on: false },
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
    whatItDoes:
      'Voice equivalent of the guest chat prompt. Answers a guest’s spoken questions using the wiki, never pushes interview questions back at them. Tone is informational and warm rather than coaxing.',
    whenItFires: [
      'A non-logged-in guest opens /guest/[token] and uses the voice tab',
    ],
    affects: [
      { label: 'Voice replies to share-link visitors', on: true },
      { label: 'Voice replies to owners or logged-in contributors (uses ember_voice.style)', on: false },
    ],
  },

  {
    key: 'ember_call.style',
    label: 'Ember Call - Style & Technique',
    group: 'Ember AI',
    description: 'Synced to Retell. Tells the Retell voice agent how to behave during outbound voice calls. The agent runs with a static system prompt (no per-call variable injection here yet), so this prompt should instruct it to open by saying what the wiki already knows about the moment, then naturally pursue who / when / where / what / why / how gaps. Live wiki context is delivered to Retell at call setup time. Saves here are pushed to Retell automatically.',
    variables: [],
    whatItDoes:
      'Behavior of the Retell voice agent during outbound phone calls — what tone it uses, how it opens, how it pursues unanswered interview topics. Important: this prompt is STATIC at the agent level — it does not receive per-call variables yet, so it cannot reference a specific ember’s wiki content directly during a call. Saving here pushes the new body to Retell automatically.',
    whenItFires: [
      'A contributor accepts a phone-call invite and Retell dials them',
      'An owner triggers a self-test call from the Tend slider',
    ],
    affects: [
      { label: 'How the Retell voice agent talks during outbound phone calls', on: true },
      { label: 'In-app mic / voice replies (uses ember_voice.style)', on: false },
      { label: 'Per-call wiki content awareness — would require dynamic-variable plumbing first', on: false },
    ],
  },

  {
    key: 'ember_sms.style',
    label: 'Ember SMS - Style & Technique',
    group: 'Ember AI',
    description: 'Controls how the system replies in SMS interview follow-ups (Twilio). Same context shape as Ember Chat but tuned for the constraints of text messages.',
    variables: ['role', 'trigger', 'title', 'snapshot'],
    whatItDoes:
      'Controls follow-up SMS messages when an interview is happening over text. Tuned for SMS constraints (short messages, plain language, no markdown). Receives only the title and snapshot — taggedPeople and wiki are NOT injected here today, so position-aware questions like "who is on the right" cannot be answered well from SMS yet.',
    whenItFires: [
      'After a contributor answers a question via SMS, this prompt decides whether to send a follow-up question',
    ],
    affects: [
      { label: 'Text SMS replies sent via Twilio during interview follow-ups', on: true },
      { label: 'Inbound SMS routing or webhook handling (code-side, not prompt-driven)', on: false },
      { label: 'In-app chat (uses ember_chat.style)', on: false },
    ],
  },

  {
    key: 'housekeeping.why_extraction',
    label: 'Why Extraction',
    group: 'Housekeeping',
    description: 'Background parser. After any chat / SMS / voice / call message, pulls out claims about why this moment mattered (motivation, occasion, significance). Stored as MemoryClaim rows with claimType="why" and surfaced in the wiki Why section. Not user-facing.',
    variables: ['title', 'wiki', 'taggedPeople', 'contributorName', 'question', 'answer'],
    whatItDoes:
      'Background AI parser that runs invisibly after every chat/voice/SMS message. Reads the user’s answer and tries to extract WHY this moment mattered (motivation, occasion, significance). Each extraction lands in the MemoryClaim table and feeds the wiki’s Why section. The user never sees this prompt fire.',
    whenItFires: [
      'After any chat reply (housekeeping runs in parallel with the AI reply)',
      'After any voice / SMS / call answer is recorded',
      'Currently gated by the ENABLE_HOUSEKEEPING_EXTRACTORS env var (off by default to save credits)',
    ],
    affects: [
      { label: 'The "Why" claims captured from messages and shown in the wiki', on: true },
      { label: 'The user-facing chat/voice reply (those use ember_chat.style / ember_voice.style)', on: false },
    ],
  },
  {
    key: 'housekeeping.emotion_extraction',
    label: 'Emotion Extraction',
    group: 'Housekeeping',
    description: 'Background parser. After any chat / SMS / voice / call message, pulls out claims about how a tagged person felt (e.g. {subject: "Mom", value: "tired but joyful"}). Stored as MemoryClaim rows with claimType="emotion" and surfaced in the wiki Emotional state section. Not user-facing.',
    variables: ['title', 'wiki', 'taggedPeople', 'contributorName', 'question', 'answer'],
    whatItDoes:
      'Background AI parser. After every chat/voice/SMS answer, reads the message and extracts emotion claims keyed to a person ("Mom: tired but joyful", "Luca: shy"). Stored as MemoryClaim rows with claimType="emotion" so the wiki’s emotional state section can use them.',
    whenItFires: [
      'After any chat / voice / SMS / call answer',
      'Currently gated by the ENABLE_HOUSEKEEPING_EXTRACTORS env var',
    ],
    affects: [
      { label: 'Emotion claims captured and rolled into the wiki', on: true },
      { label: 'The user-facing reply (different prompt)', on: false },
    ],
  },
  {
    key: 'housekeeping.extra_story_extraction',
    label: 'Extra Story Extraction',
    group: 'Housekeeping',
    description: 'Background parser. After any chat / SMS / voice / call message, pulls out anecdote-worthy excerpts (one or two sentences that read like a story). Stored as MemoryClaim rows with claimType="extra_story" and surfaced in the wiki Extra stories section. Not user-facing.',
    variables: ['title', 'wiki', 'taggedPeople', 'contributorName', 'question', 'answer'],
    whatItDoes:
      'Background AI parser. Looks at each message and pulls out short anecdote-worthy excerpts — one or two sentences that read like a story rather than a factual answer. Lands as MemoryClaim rows of type "extra_story" so the wiki has color quotes to surface.',
    whenItFires: [
      'After any chat / voice / SMS / call answer',
      'Currently gated by the ENABLE_HOUSEKEEPING_EXTRACTORS env var',
    ],
    affects: [
      { label: 'The "Extra Stories" section of the wiki', on: true },
      { label: 'The user-facing reply (different prompt)', on: false },
    ],
  },

  {
    key: 'housekeeping.place_extraction',
    label: 'Place Extraction',
    group: 'Housekeeping',
    description: 'Background parser. After any chat / SMS / voice / call message, pulls out place mentions (named venues, neighborhoods, cities, landmarks, addresses) so they can be reconciled against the photo GPS / confirmed location later. Stored as MemoryClaim rows with claimType="place". Not currently user-facing — feeds future conflict resolution.',
    variables: ['title', 'wiki', 'taggedPeople', 'contributorName', 'question', 'answer'],
    whatItDoes:
      'Background AI parser. Listens for place mentions in messages — venue names, neighborhoods, cities, landmarks, street addresses — and stores them as MemoryClaim rows of type "place". These are not yet surfaced in any user UI; they’re held for future conflict resolution between what people say and what the photo GPS shows.',
    whenItFires: [
      'After any chat / voice / SMS / call answer',
      'Currently gated by the ENABLE_HOUSEKEEPING_EXTRACTORS env var',
    ],
    affects: [
      { label: 'Stored MemoryClaim rows of type "place" (not yet user-visible)', on: true },
      { label: 'The Place block in the wiki — that’s driven by image_analysis.location_resolution', on: false },
      { label: 'The user-facing reply (different prompt)', on: false },
    ],
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
