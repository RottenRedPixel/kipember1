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
    key: 'title_generation.regenerate',
    label: 'Title Generation',
    group: 'Title Generation',
    description: 'The single prompt that powers the Title Ideas in the Edit Title slider. Receives `fullContext` (the merged ember context — analysis, location, people, memories, calls, wiki), `peopleInstruction` (everyone tagged in the photo), `preferredPeopleInstruction` (the subset of tagged people the user explicitly checked — should be favored when natural), and `optionalTaggedPeopleInstruction` (tagged people the user did not check — may inform context but should not be forced).',
    variables: ['fullContext', 'peopleInstruction', 'preferredPeopleInstruction', 'optionalTaggedPeopleInstruction'],
    whatItDoes:
      'Generates three short alternate title ideas for an ember. Honors which tagged people the user has explicitly preferred so the suggestions feature them. The slider defaults the people checklist to "all selected" so the first batch already follows everyone tagged.',
    whenItFires: [
      'User opens the Edit Title slider (initial fetch)',
      'User toggles people and presses Regen Ideas',
    ],
    affects: [
      { label: 'The list of title suggestions shown in the Title slider', on: true },
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
    key: 'ember_chat.owner_style',
    label: 'Chat (Owner)',
    group: 'Ember AI',
    description: 'In-app text chat, owner only. The owner is filling in their own ember; this prompt helps them remember more by answering their questions from the wiki and probing gently for missing details.',
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
      'Owner-facing chat bubble inside /ember/[id]. Helps the owner build out their own wiki: answers their questions from the wiki, then nudges toward the next unanswered topic when they share a fact.',
    whenItFires: [
      'Owner sends a typed message in chat → "message"',
      'Owner uploads a photo / video into chat → "photo_upload" / "video_upload" (handled with a hardcoded acknowledgement, not this prompt)',
      'Owner opens chat on an ember → "welcome_first_open" / "welcome_returning"',
    ],
    affects: [
      { label: 'Ember Chat replies sent to the owner of an ember', on: true },
      { label: 'Chat replies to a contributor (uses ember_chat.contributor_style)', on: false },
      { label: 'Chat replies to a guest (uses ember_chat.guest_style)', on: false },
    ],
  },

  {
    key: 'ember_chat.contributor_style',
    label: 'Chat (Contributor)',
    group: 'Ember AI',
    description: 'In-app text chat, signed-in contributor only. The contributor is helping fill in someone else\'s ember; this prompt helps them share what THEY remember about the moment and answers their questions from the wiki.',
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
      'Contributor-facing chat bubble. The framing is "help us hear what YOU remember about this moment" — distinct from the owner who is reconstructing their own memory.',
    whenItFires: [
      'A signed-in contributor opens chat on an ember they were invited to → "welcome_*"',
      'Contributor sends a typed message → "message"',
    ],
    affects: [
      { label: 'Ember Chat replies sent to invited contributors', on: true },
      { label: 'Chat replies to the owner (uses ember_chat.owner_style)', on: false },
      { label: 'Chat replies to a share-link guest (uses ember_chat.guest_style)', on: false },
    ],
  },

  {
    key: 'ember_chat.guest_style',
    label: 'Chat (Guest)',
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
      { label: 'Chat replies to the owner (uses ember_chat.owner_style) or contributors (ember_chat.contributor_style)', on: false },
    ],
  },

  {
    key: 'ember_voice.owner_style',
    label: 'Voice (Owner)',
    group: 'Ember AI',
    description: 'In-app voice (mic) replies sent to the owner. Spoken via TTS — same memory context as Chat (Owner) but tuned for the ear.',
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
      'claims',
      'wiki',
      'answeredTopics',
      'unansweredTopics',
      'nextTopic',
      'interviewProgress',
    ],
    whatItDoes:
      'Drives Ember\'s spoken replies when the OWNER is talking through the in-app microphone. Tuned for voice — shorter sentences, conversational rhythm. Same job as Chat (Owner): help the owner build their wiki.',
    whenItFires: [
      'Owner taps the mic in chat and speaks',
    ],
    affects: [
      { label: 'In-app voice replies sent to the owner', on: true },
      { label: 'Voice replies to a contributor (uses ember_voice.contributor_style)', on: false },
      { label: 'Voice replies to a guest (uses ember_voice.guest_style)', on: false },
    ],
  },

  {
    key: 'ember_voice.contributor_style',
    label: 'Voice (Contributor)',
    group: 'Ember AI',
    description: 'In-app voice (mic) replies sent to a signed-in contributor. Spoken via TTS — same memory context as Chat (Contributor) but tuned for the ear.',
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
      'claims',
      'wiki',
      'answeredTopics',
      'unansweredTopics',
      'nextTopic',
      'interviewProgress',
    ],
    whatItDoes:
      'Drives Ember\'s spoken replies when a CONTRIBUTOR is talking through the in-app microphone. Tuned for voice. Same job as Chat (Contributor): help the contributor share what THEY remember about the moment.',
    whenItFires: [
      'Contributor taps the mic in chat and speaks',
    ],
    affects: [
      { label: 'In-app voice replies sent to invited contributors', on: true },
      { label: 'Voice replies to the owner (uses ember_voice.owner_style)', on: false },
      { label: 'Voice replies to a guest (uses ember_voice.guest_style)', on: false },
    ],
  },

  {
    key: 'ember_voice.guest_style',
    label: 'Voice (Guest)',
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
      { label: 'Voice replies to the owner (uses ember_voice.owner_style) or contributors (ember_voice.contributor_style)', on: false },
    ],
  },

  {
    key: 'ember_call.owner_style',
    label: 'Call (Owner)',
    group: 'Ember AI',
    description: 'Phone-call agent prompt for self-test calls the owner triggers from the Tend slider. Synced to Retell when saved. Receives per-call dynamic variables: contributor_name, image_title, image_description, prior_interview_count, previous_memory_summary, follow_up_focus, plus the merged wiki bag (wiki, tagged_people, location, captured_at, claims).',
    variables: [
      'contributor_name',
      'image_title',
      'image_description',
      'previous_memory_summary',
      'follow_up_focus',
      'wiki',
      'tagged_people',
      'location',
      'captured_at',
      'claims',
    ],
    whatItDoes:
      'Behavior of the Retell voice agent when the OWNER is on the line. Frames the conversation as helping the owner remember more about their own moment.',
    whenItFires: [
      'An owner triggers a self-test call from the Tend slider',
    ],
    affects: [
      { label: 'Phone calls placed to the owner (Retell agent)', on: true },
      { label: 'Phone calls placed to contributors (uses ember_call.contributor_style)', on: false },
      { label: 'Per-call wiki awareness — see Step 3 of the chat overhaul plan', on: false },
    ],
  },

  {
    key: 'ember_call.contributor_style',
    label: 'Call (Contributor)',
    group: 'Ember AI',
    description: 'Phone-call agent prompt for outbound calls to invited contributors. Synced to Retell when saved. Receives per-call dynamic variables: contributor_name, image_title, image_description, prior_interview_count, previous_memory_summary, follow_up_focus, plus the merged wiki bag (wiki, tagged_people, location, captured_at, claims).',
    variables: [
      'contributor_name',
      'image_title',
      'image_description',
      'previous_memory_summary',
      'follow_up_focus',
      'wiki',
      'tagged_people',
      'location',
      'captured_at',
      'claims',
    ],
    whatItDoes:
      'Behavior of the Retell voice agent when a CONTRIBUTOR is on the line. Frames the conversation as helping them share what THEY remember about someone else\'s moment.',
    whenItFires: [
      'A contributor accepts a phone-call invite and Retell dials them',
    ],
    affects: [
      { label: 'Phone calls placed to contributors (Retell agent)', on: true },
      { label: 'Phone calls placed to the owner (uses ember_call.owner_style)', on: false },
    ],
  },

  {
    key: 'ember_sms.style',
    label: 'SMS',
    group: 'Ember AI',
    description: 'Controls how the system replies in SMS interview follow-ups (Twilio). Same merged-wiki context as the chat / voice prompts, tuned for the constraints of text messages.',
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
    ],
    whatItDoes:
      'Controls follow-up SMS messages when an interview is happening over text. Tuned for SMS constraints (short messages, plain language, no markdown). Receives the same merged wiki bag every other Ember AI surface gets, so it can answer questions about who, where, and what people said.',
    whenItFires: [
      'After a contributor answers a question via SMS, this prompt decides whether to send a follow-up question',
    ],
    affects: [
      { label: 'Text SMS replies sent via Twilio during interview follow-ups', on: true },
      { label: 'Inbound SMS routing or webhook handling (code-side, not prompt-driven)', on: false },
      { label: 'In-app chat (uses ember_chat.owner_style / ember_chat.contributor_style / ember_chat.guest_style)', on: false },
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
      { label: 'The user-facing chat/voice reply (those use ember_chat.* / ember_voice.* prompts)', on: false },
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

  {
    key: 'housekeeping.person_extraction',
    label: 'Person Extraction',
    group: 'Housekeeping',
    description: 'Background parser. After any chat / SMS / voice / call message, pulls out people mentions — anyone the contributor names by first name, nickname, or relationship — so the call/chat agents can know "Aunt Sue was there" even when Sue was never tagged on the photo. Stored as MemoryClaim rows with claimType="person".',
    variables: ['title', 'wiki', 'taggedPeople', 'contributorName', 'question', 'answer'],
    whatItDoes:
      'Background AI parser that scans chat / voice / call answers for people-mentions and stores each as a MemoryClaim of type "person". Surfaces in loadEmberContext as a "People mentioned (not necessarily tagged on the photo)" block — bridges the gap between "named in the Story Circle" and "tagged on the photo" so the call agent can reference people without seeing a photo position.',
    whenItFires: [
      'After any chat / voice / SMS / call answer',
      'Currently gated by the ENABLE_HOUSEKEEPING_EXTRACTORS env var',
    ],
    affects: [
      { label: 'Stored MemoryClaim rows of type "person" — surfaced in the call/chat agent prompt context', on: true },
      { label: 'The Photo Tagging UI — tagged faces are a separate KipemberTag flow', on: false },
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
