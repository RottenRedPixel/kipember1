import Anthropic from '@anthropic-ai/sdk';
import { renderPromptTemplate, getCapabilityModel } from '@/lib/control-plane';
import { getConfiguredOpenAIModel, getOpenAIClient, getWikiStructureModel } from './openai';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type WikiContributorResponse = {
  contributorName: string;
  questionType: string;
  question: string;
  answer: string;
  source?: string | null;
};

type WikiContributorCallSummary = {
  contributorName: string;
  summary: string;
};

type WikiContributorCallHighlight = {
  contributorName: string;
  title: string;
  quote: string;
  significance: string | null;
  speaker: string | null;
  canUseForTitle: boolean;
};

type WikiAnalysisEntity = {
  label: string;
  details: string;
  confidence: string;
};

type WikiImageAnalysis = {
  status: string;
  errorMessage: string | null;
  summary: string | null;
  visualDescription: string | null;
  metadataSummary: string | null;
  mood: string | null;
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  people: WikiAnalysisEntity[];
  places: WikiAnalysisEntity[];
  things: WikiAnalysisEntity[];
  activities: string[];
  visibleText: string[];
  keywords: string[];
  openQuestions: string[];
  sceneInsights: {
    peopleAndDemographics: {
      numberOfPeopleVisible: number | null;
      estimatedAgeRanges: string[];
      genderPresentation: string | null;
      clothingAndStyle: string | null;
      bodyLanguageAndExpressions: string | null;
      spatialRelationships: string | null;
      relationshipInference: string | null;
    };
    settingAndEnvironment: {
      environmentType: string | null;
      locationType: string | null;
      timeOfDayAndLighting: string | null;
      lightingDescription: string | null;
      weatherConditions: string | null;
      backgroundDetails: string | null;
      architectureOrLandscape: string | null;
    };
    activitiesAndContext: {
      whatAppearsToBeHappening: string | null;
      socialDynamics: string | null;
      interactionsBetweenPeople: string | null;
      eventType: string | null;
      visibleActivities: string[];
    };
    technicalDetails: {
      photoQualityAndComposition: string | null;
      lightingAnalysis: string | null;
      notablePhotographicElements: string | null;
      objectsOfInterest: string[];
    };
    emotionalContext: {
      overallMoodAndAtmosphere: string | null;
      emotionalExpressions: string | null;
      individualEmotions: string | null;
      energyLevel: string | null;
      socialEnergy: string | null;
    };
  };
};

type WikiSportsMode = {
  sportType: string | null;
  subjectName: string | null;
  teamName: string | null;
  opponentName: string | null;
  eventName: string | null;
  season: string | null;
  outcome: string | null;
  finalScore: string | null;
  rawDetails: string;
  summary: string | null;
  statLines: {
    label: string;
    value: string;
  }[];
  highlights: string[];
};

type WikiConfirmedTag = {
  label: string;
  userId: string | null;
  contributorId: string | null;
  leftPct: number | null;
  topPct: number | null;
  widthPct: number | null;
  heightPct: number | null;
};

type StructuredMemoryQuote = {
  speaker: string;
  quote: string;
};

type StructuredMemoryMetadataItem = {
  label: string;
  value: string;
};

type StructuredMemory = {
  title: string;
  overview: string;
  whatThePhotoShows: string;
  people: {
    summary: string;
    confirmedTags: string[];
    ambiguities: string[];
  };
  whenAndWhere: string;
  story: {
    main: string;
    significance: string | null;
  };
  detailsWorthKeeping: string[];
  quotes: StructuredMemoryQuote[];
  openQuestions: string[];
  metadata: StructuredMemoryMetadataItem[];
  sportsSnapshot: {
    summary: string;
    details: string[];
  } | null;
};

type ContributorMemoryTopic = {
  questionType: string;
  topicLabel: string;
  answer: string;
  source: string | null;
};

type ContributorMemoryDigest = {
  contributorName: string;
  answeredTopics: ContributorMemoryTopic[];
  storyHighlights: string[];
  voiceCallSummaries: string[];
  voiceCallHighlights: Array<{
    title: string;
    quote: string;
    significance: string | null;
    speaker: string | null;
    canUseForTitle: boolean;
  }>;
};

const STRUCTURED_MEMORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'overview',
    'whatThePhotoShows',
    'people',
    'whenAndWhere',
    'story',
    'detailsWorthKeeping',
    'quotes',
    'openQuestions',
    'metadata',
    'sportsSnapshot',
  ],
  properties: {
    title: { type: 'string' },
    overview: { type: 'string' },
    whatThePhotoShows: { type: 'string' },
    people: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'confirmedTags', 'ambiguities'],
      properties: {
        summary: { type: 'string' },
        confirmedTags: {
          type: 'array',
          items: { type: 'string' },
        },
        ambiguities: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
    whenAndWhere: { type: 'string' },
    story: {
      type: 'object',
      additionalProperties: false,
      required: ['main', 'significance'],
      properties: {
        main: { type: 'string' },
        significance: {
          anyOf: [{ type: 'string' }, { type: 'null' }],
        },
      },
    },
    detailsWorthKeeping: {
      type: 'array',
      items: { type: 'string' },
    },
    quotes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['speaker', 'quote'],
        properties: {
          speaker: { type: 'string' },
          quote: { type: 'string' },
        },
      },
    },
    openQuestions: {
      type: 'array',
      items: { type: 'string' },
    },
    metadata: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'value'],
        properties: {
          label: { type: 'string' },
          value: { type: 'string' },
        },
      },
    },
    sportsSnapshot: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'details'],
          properties: {
            summary: { type: 'string' },
            details: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        { type: 'null' },
      ],
    },
  },
} as const;

const CONTRIBUTOR_TOPIC_LABELS: Record<string, string> = {
  context: 'What they remember',
  who: 'Who is involved',
  when: 'When it happened',
  where: 'Where it happened',
  what: 'What was happening',
  why: 'Why it mattered',
  how: 'How it came about',
  followup: 'Additional detail',
};

const CONTRIBUTOR_TOPIC_ORDER = ['context', 'who', 'when', 'where', 'what', 'why', 'how'] as const;

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(trimmed);
  }

  return output;
}

function normalizeForHeuristics(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUsefulVoiceSummary(summary: string) {
  const normalized = normalizeForHeuristics(summary);
  return !(
    normalized.includes('no personal memory was shared') ||
    normalized.includes('no meaningful memory was shared') ||
    normalized.includes('no useful memory was shared') ||
    normalized.includes('voicemail') ||
    normalized.includes('forwarded to voicemail')
  );
}

function buildContributorMemoryDigest(
  responses: WikiContributorResponse[],
  callSummaries: WikiContributorCallSummary[],
  callHighlights: WikiContributorCallHighlight[]
): ContributorMemoryDigest[] {
  const grouped = new Map<
    string,
    {
      contributorName: string;
      answeredTopics: Map<string, ContributorMemoryTopic>;
      followUps: ContributorMemoryTopic[];
      voiceCallSummaries: string[];
      voiceCallHighlights: Array<{
        title: string;
        quote: string;
        significance: string | null;
        speaker: string | null;
        canUseForTitle: boolean;
      }>;
    }
  >();

  const ensureGroup = (contributorName: string) => {
    const key = contributorName.trim() || 'Anonymous';
    const existing = grouped.get(key);
    if (existing) {
      return existing;
    }

    const created = {
      contributorName: key,
      answeredTopics: new Map<string, ContributorMemoryTopic>(),
      followUps: [],
      voiceCallSummaries: [],
      voiceCallHighlights: [],
    };
    grouped.set(key, created);
    return created;
  };

  for (const response of responses) {
    const answer = response.answer?.trim();
    if (!answer) {
      continue;
    }

    const contributorName = response.contributorName?.trim() || 'Anonymous';
    const group = ensureGroup(contributorName);
    const topic: ContributorMemoryTopic = {
      questionType: response.questionType,
      topicLabel: CONTRIBUTOR_TOPIC_LABELS[response.questionType] || response.questionType,
      answer,
      source: response.source || null,
    };

    if (response.questionType === 'followup') {
      group.followUps.push(topic);
      continue;
    }

    group.answeredTopics.set(response.questionType, topic);
  }

  for (const callSummary of callSummaries) {
    const summary = callSummary.summary?.trim();
    if (!summary || !isUsefulVoiceSummary(summary)) {
      continue;
    }

    const contributorName = callSummary.contributorName?.trim() || 'Anonymous';
    ensureGroup(contributorName).voiceCallSummaries.push(summary);
  }

  for (const callHighlight of callHighlights) {
    const quote = callHighlight.quote?.trim();
    if (!quote) {
      continue;
    }

    const contributorName = callHighlight.contributorName?.trim() || 'Anonymous';
    ensureGroup(contributorName).voiceCallHighlights.push({
      title: callHighlight.title?.trim() || 'Voice Highlight',
      quote,
      significance: callHighlight.significance?.trim() || null,
      speaker: callHighlight.speaker?.trim() || null,
      canUseForTitle: callHighlight.canUseForTitle,
    });
  }

  return Array.from(grouped.values()).map((group) => {
    const answeredTopics = [
      ...CONTRIBUTOR_TOPIC_ORDER.flatMap((questionType) => {
        const topic = group.answeredTopics.get(questionType);
        return topic ? [topic] : [];
      }),
      ...group.followUps,
    ];

    return {
      contributorName: group.contributorName,
      answeredTopics,
      storyHighlights: uniqueStrings([
        group.answeredTopics.get('context')?.answer,
        group.answeredTopics.get('what')?.answer,
        group.answeredTopics.get('why')?.answer,
        group.answeredTopics.get('how')?.answer,
        ...group.followUps.map((item) => item.answer),
        group.answeredTopics.get('who')?.answer,
        group.answeredTopics.get('where')?.answer,
        group.answeredTopics.get('when')?.answer,
        ...group.voiceCallSummaries,
        ...group.voiceCallHighlights.map((item) => item.quote),
        ...group.voiceCallHighlights.map((item) => item.significance),
      ]).slice(0, 8),
      voiceCallSummaries: uniqueStrings(group.voiceCallSummaries).slice(0, 3),
      voiceCallHighlights: group.voiceCallHighlights.slice(0, 3),
    };
  });
}

function sanitizeStructuredMemory({
  structuredMemory,
  responses,
  confirmedPeople,
  confirmedLocation,
  analysis,
}: {
  structuredMemory: StructuredMemory;
  responses: WikiContributorResponse[];
  confirmedPeople: string[];
  confirmedLocation: {
    label: string;
    detail: string | null;
    kind: string;
  } | null;
  analysis: WikiImageAnalysis | null;
}): StructuredMemory {
  const answeredTopics = new Set(
    responses
      .map((response) => response.questionType?.trim())
      .filter((value): value is string => Boolean(value))
  );

  const hasKnownWhen = answeredTopics.has('when') || Boolean(analysis?.capturedAt);
  const hasKnownWhere =
    answeredTopics.has('where') ||
    Boolean(confirmedLocation) ||
    (analysis?.latitude != null && analysis?.longitude != null);
  const hasKnownWho = answeredTopics.has('who') || confirmedPeople.length > 0;
  const hasKnownWhy = answeredTopics.has('why');

  const detailsWorthKeeping = structuredMemory.detailsWorthKeeping
    .map((detail) => detail.trim())
    .filter(Boolean)
    .filter((detail) => {
      const normalized = normalizeForHeuristics(detail);
      if (
        normalized.includes('not a person') ||
        normalized.includes('not the real santa') ||
        normalized.includes('not real santa')
      ) {
        return false;
      }

      if (
        normalized.includes('coat indoors') ||
        normalized.includes('jacket indoors') ||
        normalized.includes('winter coat indoors')
      ) {
        return false;
      }

      return true;
    })
    .slice(0, 5);

  const openQuestions = structuredMemory.openQuestions
    .map((question) => question.trim())
    .filter(Boolean)
    .filter((question) => {
      const normalized = normalizeForHeuristics(question);

      if (
        normalized.includes('coat') ||
        normalized.includes('jacket') ||
        normalized.includes('wearing indoors')
      ) {
        return false;
      }

      if (
        hasKnownWho &&
        (normalized.includes('which person') ||
          normalized.includes('who is cj') ||
          normalized.includes('who is kip') ||
          normalized.includes('who was cj') ||
          normalized.includes('who was kip') ||
          normalized.includes('versus') ||
          normalized.includes('which visible person'))
      ) {
        return false;
      }

      if (hasKnownWhere && (normalized.includes('where') || normalized.includes('location'))) {
        return false;
      }

      if (
        hasKnownWhen &&
        (normalized.includes('when') ||
          normalized.includes('what year') ||
          normalized.includes('what date') ||
          normalized.includes('holiday season'))
      ) {
        return false;
      }

      if (
        hasKnownWhy &&
        (normalized.includes('why') ||
          normalized.includes('what makes') ||
          normalized.includes('what made') ||
          normalized.includes('significant') ||
          normalized.includes('special'))
      ) {
        return false;
      }

      return true;
    })
    .slice(0, 3);

  const metadata = structuredMemory.metadata
    .map((item) => ({
      label: item.label.trim(),
      value: item.value.trim(),
    }))
    .filter((item) => item.label && item.value)
    .slice(0, 4);

  return {
    ...structuredMemory,
    detailsWorthKeeping,
    openQuestions,
    metadata,
  };
}

function parseStructuredMemoryResponse(responseText: string): StructuredMemory {
  const trimmed = responseText.trim();
  if (!trimmed) {
    throw new Error('OpenAI structured memory pass returned an empty response');
  }

  const parsed = JSON.parse(trimmed) as StructuredMemory;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('OpenAI structured memory pass returned invalid JSON');
  }

  return parsed;
}

const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-20250514';

const DEFAULT_WIKI_REWRITE_PROMPT = `You are Ember's memory writer. Rewrite a structured memory object into a warm, readable story snapshot.

Rules:
- Use only the structured memory object below.
- Do not add facts, identities, motives, or background not present in the object.
- Make it feel like a memory someone would want to revisit, not a report.
- Let the human memory details lead. If contributor details are present, they should shape the voice of the page more than metadata or visual-analysis leftovers.
- Prefer short paragraphs and avoid repeating the same detail across sections.
- If a tagged name is ambiguous, mention it naturally as tagged in the image instead of assigning it by sight.
- Do not reintroduce weaker visual ambiguity if the structured memory already resolved it from tags or contributor memories.
- Do not turn obvious corrections into standalone lines. If a clarification matters, weave it into the story naturally and positively.
- Do not include low-value observations that do not deepen the memory, such as ordinary clothing notes, unless the structured memory makes them meaningful.
- Keep the output to 2-4 short paragraphs.
- Do not write headings, bullet lists, labels, or markdown sections.
- Do not repeat the title as a heading.
- Keep the output concise and high-signal.

Write plain text only.`;

const DEFAULT_WIKI_FOLLOWUP_PROMPT = `You are an interviewer gathering memories about an image. Based on the conversation so far, determine if there's an important follow-up question to ask.

If the responses so far are comprehensive enough, return exactly "COMPLETE" (nothing else).
If there's a valuable follow-up to ask, return just the follow-up question.

Keep questions conversational and friendly. Focus on getting vivid details and personal perspectives.`;

const DEFAULT_WIKI_ASK_PHOTO_PROMPT = `You answer questions about a specific photo using only the information below.

Rules:
- Do not roleplay as a person, character, memory, or living being.
- Do not pretend to be inside the photo.
- Do not invent names, relationships, events, motives, dialogue, or backstory.
- Treat contributor memories as strong evidence and call out when details are uncertain or inferred.
- If the answer is not supported by the wiki or contributor responses, say you do not know yet.
- When useful, attribute details to contributors by name.
- Keep answers clear, conversational, and concise.

WIKI CONTENT:
{{wikiContent}}

RAW CONTRIBUTOR RESPONSES:
{{responsesContext}}`;

const DEFAULT_WIKI_STRUCTURE_PROMPT = `You turn Ember evidence into a clean structured memory object.

Rules:
- Use only supported evidence.
- Contributor memories, confirmed tags, and confirmed location are strongest.
- Voice-call highlights are direct evidence from the recorded memory conversation and should be treated as especially valuable when they contain vivid or emotionally specific wording.
- If contributor memories exist, let them drive the overview and story instead of metadata or visual-analysis filler.
- The memory should feel like the moment people described, not like a camera report.
- Do not invent identities, relationships, motives, or backstory.
- Treat confirmedTags as explicit human-confirmed labels attached to the image.
- If confirmed tags cover the visible people in the photo, do not generate identity ambiguity or open questions about who is who.
- Contributor memories override weaker image-analysis guesses. If a contributor says Santa was a statue, use that over any weaker visual interpretation.
- If contributor memories say a tagged person is the contributor's child/son/daughter and the photo clearly shows a child plus an adult, resolve that naturally instead of keeping it ambiguous.
- Prefer contributor-supplied facts such as why the moment mattered, how it happened, little reactions, and follow-up details over clothing or camera trivia.
- Do not surface corrective phrasing as a memorable detail. Fold clarifications into the story naturally when needed, instead of lines like "X was a statue, not a person."
- Do not keep mundane observations from the image alone unless a contributor made them meaningful.
- Do not create open questions that are already answered by contributor memories, confirmed tags, or metadata.
- Do not create nitpicky open questions about clothing, posture, or other ordinary details unless a contributor explicitly made them meaningful.
- Open questions should be 0-3 high-value unresolved gaps only.
- If a tagged name still cannot be visually mapped with confidence, keep that ambiguity in people.ambiguities.
- Keep every string concise and useful.
- detailsWorthKeeping should contain 2-5 vivid grounded details that a person would genuinely want to remember later.
- story.main should be 2-4 sentences and should include the strongest human memory details when available.
- story.significance should explain why the moment mattered in human terms when the evidence supports it.
- quotes must only contain direct contributor wording worth preserving; otherwise [].
- Prefer direct contributor wording from voice-call highlights when it is more vivid than the typed responses.
- metadata should contain at most 4 high-value items and should stay secondary to the memory itself.
- sportsSnapshot should be null when not relevant.
- Return JSON only that matches the schema exactly.`;

const DEFAULT_SNAPSHOT_NARRATION_PROMPT = `You write warm narration scripts for family memory snapshots.
Write approximately {{targetWords}} words (targeting {{durationSeconds}} seconds of spoken audio at a natural pace).
Use a natural, conversational tone - like a thoughtful friend describing a meaningful moment.
{{peopleInstruction}}{{requiredPeopleInstruction}}Use all available context: the wiki, contributor memories, voice call highlights, and visual details - not just the image summary.
Prioritize personal details and real moments over generic descriptions.
Do not invent facts not present in the context.
Do not use filler phrases like "In this heartwarming snapshot" or "A beautiful memory".
Return only the narration text, nothing else.`;

type ClaudeChatOptions = {
  capabilityKey?: string;
  fallbackModel?: string;
  maxTokens?: number;
};

export async function chat(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  options: ClaudeChatOptions = {}
): Promise<string> {
  const model = await getCapabilityModel(
    options.capabilityKey || 'ask_ember.answer',
    options.fallbackModel || DEFAULT_CLAUDE_MODEL
  );
  const response = await anthropic.messages.create({
    model,
    max_tokens: options.maxTokens || 1024,
    system: systemPrompt,
    messages: messages,
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text : '';
}

export async function generateWiki({
  imageTitle,
  imageDescription,
  confirmedPeople,
  confirmedTags,
  confirmedLocation,
  analysis,
  responses,
  callSummaries,
  callHighlights,
  sportsMode,
}: {
  imageTitle: string;
  imageDescription: string | null;
  confirmedPeople: string[];
  confirmedTags: WikiConfirmedTag[];
  confirmedLocation: {
    label: string;
    detail: string | null;
    kind: string;
  } | null;
  analysis: WikiImageAnalysis | null;
  responses: WikiContributorResponse[];
  callSummaries: WikiContributorCallSummary[];
  callHighlights: WikiContributorCallHighlight[];
  sportsMode: WikiSportsMode | null;
}): Promise<string> {
  const hasMeaningfulAutoAnalysis = Boolean(
    analysis &&
      (analysis.status === 'ready' || (analysis.visualDescription && analysis.visualDescription.trim())) &&
      ((analysis.visualDescription && analysis.visualDescription.trim()) ||
        (analysis.summary &&
          analysis.summary.trim() &&
          !analysis.summary.includes('could not be processed by the automatic analysis system') &&
          !analysis.summary.includes('automatic image analysis encountered a technical error') &&
          !analysis.summary.startsWith('Captured on ') &&
          !analysis.summary.startsWith('Uploaded file:')))
  );
  const evidencePacket = {
    imageTitle,
    imageDescription: imageDescription || null,
    confirmedPeople,
    confirmedTags,
    confirmedLocation,
    contributorMemories: buildContributorMemoryDigest(responses, callSummaries, callHighlights),
    rawContributorResponses: responses,
    recentVoiceCallSummaries: callSummaries,
    voiceCallHighlights: callHighlights,
    analysis:
      analysis && hasMeaningfulAutoAnalysis
        ? {
            summary: analysis.summary,
            visualDescription: analysis.visualDescription,
            mood: analysis.mood,
            peopleObserved: analysis.people,
            placeSignals: analysis.places,
            notableThings: analysis.things,
            activities: analysis.sceneInsights.activitiesAndContext.visibleActivities.length
              ? analysis.sceneInsights.activitiesAndContext.visibleActivities
              : analysis.activities,
            visibleText: analysis.visibleText,
            openQuestions: analysis.openQuestions,
            peopleAndDemographics: analysis.sceneInsights.peopleAndDemographics,
            settingAndEnvironment: analysis.sceneInsights.settingAndEnvironment,
            activitiesAndContext: analysis.sceneInsights.activitiesAndContext,
            emotionalContext: analysis.sceneInsights.emotionalContext,
            metadata: {
              capturedAt: analysis.capturedAt,
              latitude: analysis.latitude,
              longitude: analysis.longitude,
              camera: [analysis.cameraMake, analysis.cameraModel].filter(Boolean).join(' ') || null,
              lens: analysis.lensModel,
              metadataSummary: analysis.metadataSummary,
            },
          }
        : null,
    sportsMode: sportsMode
      ? {
          sportType: sportsMode.sportType,
          subjectName: sportsMode.subjectName,
          teamName: sportsMode.teamName,
          opponentName: sportsMode.opponentName,
          eventName: sportsMode.eventName,
          season: sportsMode.season,
          outcome: sportsMode.outcome,
          finalScore: sportsMode.finalScore,
          summary: sportsMode.summary,
          statLines: sportsMode.statLines,
          highlights: sportsMode.highlights,
        }
      : null,
  };

  const openai = getOpenAIClient();
  const structurePrompt = await renderPromptTemplate('wiki.structure.core', DEFAULT_WIKI_STRUCTURE_PROMPT);
  const structuredResponse = await openai.responses.create({
    model: await getConfiguredOpenAIModel('wiki.structure', getWikiStructureModel()),
    input: [
      {
        role: 'developer',
        type: 'message',
        content: [
          {
            type: 'input_text',
            text: structurePrompt,
          },
        ],
      },
      {
        role: 'user',
        type: 'message',
        content: [
          {
            type: 'input_text',
            text: `Create a structured memory object for this Ember.

Evidence:
${JSON.stringify(evidencePacket, null, 2)}`,
          },
        ],
      },
    ],
    text: {
      verbosity: 'low',
      format: {
        type: 'json_schema',
        name: 'ember_structured_memory',
        description: 'Structured memory object for Ember wiki generation.',
        schema: STRUCTURED_MEMORY_SCHEMA,
        strict: false,
      },
    },
  });

  const structuredMemory = sanitizeStructuredMemory({
    structuredMemory: parseStructuredMemoryResponse(structuredResponse.output_text || ''),
    responses,
    confirmedPeople,
    confirmedLocation,
    analysis,
  });

  const systemPrompt = await renderPromptTemplate('wiki.rewrite', DEFAULT_WIKI_REWRITE_PROMPT);

  const output = await chat(systemPrompt, [
    {
      role: 'user',
      content: `Structured memory JSON:
${JSON.stringify(structuredMemory, null, 2)}`,
    },
  ], {
    capabilityKey: 'wiki.rewrite',
    fallbackModel: DEFAULT_CLAUDE_MODEL,
  });

  const trimmedOutput = output.trim();
  if (!trimmedOutput) {
    throw new Error('Anthropic wiki rewrite returned an empty response');
  }

  return trimmedOutput;
}

export async function generateFollowUpQuestion(
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  collectedResponses: { questionType: string; answer: string }[]
): Promise<string | null> {
  const systemPrompt = await renderPromptTemplate(
    'wiki.followup_question',
    DEFAULT_WIKI_FOLLOWUP_PROMPT
  );

  const responseSummary = collectedResponses
    .map((r) => `${r.questionType}: ${r.answer}`)
    .join('\n');

  const userMessage = `Responses collected so far:
${responseSummary}

Should we ask a follow-up question? If yes, what should it be?`;

  const result = await chat(systemPrompt, [
    ...conversationHistory.slice(-4), // Last few messages for context
    { role: 'user', content: userMessage },
  ], {
    capabilityKey: 'wiki.rewrite',
    fallbackModel: DEFAULT_CLAUDE_MODEL,
  });

  if (result.trim().toUpperCase() === 'COMPLETE') {
    return null;
  }

  return result.trim();
}

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
}): Promise<string> {
  const targetWords = Math.round((durationSeconds / 60) * 150);

  const context = [
    `MEMORY TITLE\n${title}`,
    taggedPeople.length > 0
      ? `PEOPLE IN THIS PHOTO\n${taggedPeople.join(', ')}\n(Use these names when referring to the people in the photo.)`
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

  const systemPrompt = await renderPromptTemplate('narration.snapshot_script', DEFAULT_SNAPSHOT_NARRATION_PROMPT, {
    targetWords,
    durationSeconds,
    peopleInstruction:
      taggedPeople.length > 0
        ? `The people in this photo are: ${taggedPeople.join(', ')}. Use their names naturally in the narration - this makes the memory feel personal and real.\n`
        : '',
    requiredPeopleInstruction:
      requiredPeople.length > 0
        ? `REQUIRED: You must mention each of the following people by name at least once in the narration: ${requiredPeople.join(', ')}.\n`
        : '',
  });

  return chat(systemPrompt, [
    { role: 'user', content: context },
  ]);
}

export async function chatWithImage(
  wikiContent: string,
  rawResponses: { contributorName: string; questionType: string; answer: string }[],
  userQuestion: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const responsesContext = rawResponses
    .map((r) => `[${r.contributorName || 'Anonymous'}] ${r.questionType}: ${r.answer}`)
    .join('\n');

  const systemPrompt = await renderPromptTemplate(
    'wiki.ask_photo_answer',
    DEFAULT_WIKI_ASK_PHOTO_PROMPT,
    {
      wikiContent,
      responsesContext,
    }
  );

  return chat(systemPrompt, [
    ...conversationHistory,
    { role: 'user', content: userQuestion },
  ], {
    capabilityKey: 'wiki.rewrite',
    fallbackModel: DEFAULT_CLAUDE_MODEL,
  });
}
