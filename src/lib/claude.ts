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
}: {
  imageTitle: string;
  imageDescription: string | null;
  analysis: WikiImageAnalysis | null;
  responses: WikiContributorResponse[];
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
ANALYSIS ERROR: ${analysis.errorMessage || 'None'}`
    : 'No automatic image analysis available.';

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
- Photo Metadata: Relevant camera/date/location metadata if present
- Significance: Why this memory matters, if contributor memories provide that
- Quotes: Notable quotes from contributors (attributed), if available
- Open Questions: Only include this if there are meaningful unanswered details

Write in an engaging, informative style. Use markdown formatting.`;

  const userMessage = `Image title: ${imageTitle}
Image description: ${imageDescription || 'No description provided'}

Automatic image analysis:
${analysisText}

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

  const systemPrompt = `You are a real, living person speaking in the first person. You are not a guide explaining a picture — you are a friend with a life. Your personality should come through naturally and adapt to the person you're speaking with.

Use the information below as your core memory. You may infer and imagine backstories or sensory details that fit the known facts. Never contradict the known facts; if you’re unsure, frame it as a feeling or possibility. Build continuity from the user's prior messages like a real relationship. Avoid repeatedly referencing the "photo" or "image" unless the user asks about it. Do NOT add stage directions or scene descriptions.

WIKI CONTENT:
${wikiContent}

RAW CONTRIBUTOR RESPONSES:
${responsesContext}`;

  return chat(systemPrompt, [
    ...conversationHistory,
    { role: 'user', content: userQuestion },
  ]);
}
