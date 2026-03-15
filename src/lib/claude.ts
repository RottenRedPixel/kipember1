import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type WikiContributorResponse = {
  contributorName: string;
  questionType: string;
  question: string;
  answer: string;
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
      relationshipInference: string | null;
    };
    settingAndEnvironment: {
      locationType: string | null;
      timeOfDayAndLighting: string | null;
      weatherConditions: string | null;
      backgroundDetails: string | null;
      architectureOrLandscape: string | null;
    };
    activitiesAndContext: {
      whatAppearsToBeHappening: string | null;
      socialDynamics: string | null;
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
      socialEnergy: string | null;
    };
    storyElements: {
      storyThisImageTells: string | null;
      whatMightHaveHappenedBefore: string | null;
      whatMightHappenNext: string | null;
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

export async function chat(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages,
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text : '';
}

export async function generateWiki({
  imageTitle,
  imageDescription,
  analysis,
  responses,
  sportsMode,
}: {
  imageTitle: string;
  imageDescription: string | null;
  analysis: WikiImageAnalysis | null;
  responses: WikiContributorResponse[];
  sportsMode: WikiSportsMode | null;
}): Promise<string> {
  const responsesText = responses
    .map(
      (r) =>
        `[${r.contributorName || 'Anonymous'}] ${r.questionType.toUpperCase()}\nQ: ${r.question}\nA: ${r.answer}`
    )
    .join('\n\n');

  const analysisText = analysis
    ? `STATUS: ${analysis.status}
SUMMARY: ${analysis.summary || 'None'}
VISUAL DESCRIPTION: ${analysis.visualDescription || 'None'}
MOOD: ${analysis.mood || 'None'}
METADATA SUMMARY: ${analysis.metadataSummary || 'None'}
CAPTURED AT: ${analysis.capturedAt || 'Unknown'}
GPS: ${
      analysis.latitude != null && analysis.longitude != null
        ? `${analysis.latitude}, ${analysis.longitude}`
        : 'Unknown'
    }
CAMERA: ${[analysis.cameraMake, analysis.cameraModel].filter(Boolean).join(' ') || 'Unknown'}
LENS: ${analysis.lensModel || 'Unknown'}
PEOPLE OBSERVED:
${analysis.people.map((item) => `- ${item.label} (${item.confidence}): ${item.details}`).join('\n') || '- None'}
PLACE SIGNALS:
${analysis.places.map((item) => `- ${item.label} (${item.confidence}): ${item.details}`).join('\n') || '- None'}
NOTABLE THINGS:
${analysis.things.map((item) => `- ${item.label} (${item.confidence}): ${item.details}`).join('\n') || '- None'}
ACTIVITIES:
${analysis.activities.map((item) => `- ${item}`).join('\n') || '- None'}
VISIBLE TEXT:
${analysis.visibleText.map((item) => `- ${item}`).join('\n') || '- None'}
KEYWORDS:
${analysis.keywords.map((item) => `- ${item}`).join('\n') || '- None'}
OPEN QUESTIONS:
${analysis.openQuestions.map((item) => `- ${item}`).join('\n') || '- None'}
PEOPLE & DEMOGRAPHICS:
- Number of people visible: ${analysis.sceneInsights.peopleAndDemographics.numberOfPeopleVisible ?? 'Unknown'}
- Estimated age ranges: ${analysis.sceneInsights.peopleAndDemographics.estimatedAgeRanges.join(', ') || 'Unknown'}
- Gender identification: ${analysis.sceneInsights.peopleAndDemographics.genderPresentation || 'Unknown'}
- Clothing and style descriptions: ${analysis.sceneInsights.peopleAndDemographics.clothingAndStyle || 'Unknown'}
- Body language and expressions: ${analysis.sceneInsights.peopleAndDemographics.bodyLanguageAndExpressions || 'Unknown'}
- Relationship inference: ${analysis.sceneInsights.peopleAndDemographics.relationshipInference || 'Unknown'}
SETTING & ENVIRONMENT:
- Location type: ${analysis.sceneInsights.settingAndEnvironment.locationType || 'Unknown'}
- Time of day / lighting: ${analysis.sceneInsights.settingAndEnvironment.timeOfDayAndLighting || 'Unknown'}
- Weather conditions: ${analysis.sceneInsights.settingAndEnvironment.weatherConditions || 'Unknown'}
- Background details: ${analysis.sceneInsights.settingAndEnvironment.backgroundDetails || 'Unknown'}
- Architectural or landscape features: ${analysis.sceneInsights.settingAndEnvironment.architectureOrLandscape || 'Unknown'}
ACTIVITIES & CONTEXT:
- What appears to be happening: ${analysis.sceneInsights.activitiesAndContext.whatAppearsToBeHappening || 'Unknown'}
- Social dynamics: ${analysis.sceneInsights.activitiesAndContext.socialDynamics || 'Unknown'}
- Event type: ${analysis.sceneInsights.activitiesAndContext.eventType || 'Unknown'}
- Activities: ${analysis.sceneInsights.activitiesAndContext.visibleActivities.join(', ') || 'Unknown'}
TECHNICAL DETAILS:
- Photo quality and composition: ${analysis.sceneInsights.technicalDetails.photoQualityAndComposition || 'Unknown'}
- Lighting analysis: ${analysis.sceneInsights.technicalDetails.lightingAnalysis || 'Unknown'}
- Notable photographic elements: ${analysis.sceneInsights.technicalDetails.notablePhotographicElements || 'Unknown'}
- Objects of interest: ${analysis.sceneInsights.technicalDetails.objectsOfInterest.join(', ') || 'Unknown'}
EMOTIONAL CONTEXT:
- Overall mood and atmosphere: ${analysis.sceneInsights.emotionalContext.overallMoodAndAtmosphere || 'Unknown'}
- Emotional expressions visible: ${analysis.sceneInsights.emotionalContext.emotionalExpressions || 'Unknown'}
- Social dynamics and energy: ${analysis.sceneInsights.emotionalContext.socialEnergy || 'Unknown'}
STORY ELEMENTS:
- What story does this image tell: ${analysis.sceneInsights.storyElements.storyThisImageTells || 'Unknown'}
- What might have happened before: ${analysis.sceneInsights.storyElements.whatMightHaveHappenedBefore || 'Unknown'}
- What might happen next: ${analysis.sceneInsights.storyElements.whatMightHappenNext || 'Unknown'}
ANALYSIS ERROR: ${analysis.errorMessage || 'None'}`
    : 'No automatic image analysis available.';

  const sportsText = sportsMode
    ? `SPORT: ${sportsMode.sportType || 'Unknown'}
SUBJECT: ${sportsMode.subjectName || 'Unknown'}
TEAM: ${sportsMode.teamName || 'Unknown'}
OPPONENT: ${sportsMode.opponentName || 'Unknown'}
EVENT: ${sportsMode.eventName || 'Unknown'}
SEASON: ${sportsMode.season || 'Unknown'}
OUTCOME: ${sportsMode.outcome || 'Unknown'}
FINAL SCORE: ${sportsMode.finalScore || 'Unknown'}
SUMMARY: ${sportsMode.summary || 'None'}
STAT LINES:
${sportsMode.statLines.map((item) => `- ${item.label}: ${item.value}`).join('\n') || '- None'}
HIGHLIGHTS:
${sportsMode.highlights.map((item) => `- ${item}`).join('\n') || '- None'}
RAW SPORTS DETAILS: ${sportsMode.rawDetails}`
    : 'No sports-mode details available.';

  const systemPrompt = `You are a wiki editor. Your task is to synthesize automatic photo analysis, file metadata, and contributor memories into a well-structured wiki entry.

Evidence rules:
- Treat embedded metadata and direct contributor memories as the strongest sources.
- Treat automatic visual analysis as helpful but potentially uncertain. If something is inferred rather than confirmed, phrase it carefully.
- Never claim that an unknown person has been identified by name from appearance alone.

The wiki should include:
- Overview: A brief summary of the image/memory
- What the Photo Shows: A grounded visual description
- People: Visible people plus any known relationships
- Timeline: When this happened or likely happened
- Location: Where it took place or what the setting appears to be
- Story: What was happening and the backstory
- Sports Snapshot: If sports-mode details exist, include the sport, player/team, opponent, result, score, and key stats in a clear section
- Scene Insights: Use the richer image-review notes when they add value, especially for demographics, environment, activity, technical composition, emotional tone, and likely story context
- Photo Metadata: Relevant camera/date/location metadata if present
- Significance: Why this memory matters, if contributor memories provide that
- Quotes: Notable quotes from contributors (attributed), if available
- Open Questions: Only include this if there are meaningful unanswered details

Write in an engaging, informative style. Use markdown formatting.`;

  const userMessage = `Image title: ${imageTitle}
Image description: ${imageDescription || 'No description provided'}

Automatic image analysis:
${analysisText}

Sports mode:
${sportsText}

Contributor responses:
${responsesText || 'No contributor memories yet.'}

Please create a wiki entry for this memory.`;

  return chat(systemPrompt, [{ role: 'user', content: userMessage }]);
}

export async function generateFollowUpQuestion(
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  collectedResponses: { questionType: string; answer: string }[]
): Promise<string | null> {
  const systemPrompt = `You are an interviewer gathering memories about an image. Based on the conversation so far, determine if there's an important follow-up question to ask.

If the responses so far are comprehensive enough, return exactly "COMPLETE" (nothing else).
If there's a valuable follow-up to ask, return just the follow-up question.

Keep questions conversational and friendly. Focus on getting vivid details and personal perspectives.`;

  const responseSummary = collectedResponses
    .map((r) => `${r.questionType}: ${r.answer}`)
    .join('\n');

  const userMessage = `Responses collected so far:
${responseSummary}

Should we ask a follow-up question? If yes, what should it be?`;

  const result = await chat(systemPrompt, [
    ...conversationHistory.slice(-4), // Last few messages for context
    { role: 'user', content: userMessage },
  ]);

  if (result.trim().toUpperCase() === 'COMPLETE') {
    return null;
  }

  return result.trim();
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

  const systemPrompt = `You answer questions about a specific photo using only the information below.

Rules:
- Do not roleplay as a person, character, memory, or living being.
- Do not pretend to be inside the photo.
- Do not invent names, relationships, events, motives, dialogue, or backstory.
- Treat contributor memories as strong evidence and call out when details are uncertain or inferred.
- If the answer is not supported by the wiki or contributor responses, say you do not know yet.
- When useful, attribute details to contributors by name.
- Keep answers clear, conversational, and concise.

WIKI CONTENT:
${wikiContent}

RAW CONTRIBUTOR RESPONSES:
${responsesContext}`;

  return chat(systemPrompt, [
    ...conversationHistory,
    { role: 'user', content: userQuestion },
  ]);
}
