import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

export async function generateWiki(
  imageDescription: string,
  responses: { contributorName: string; questionType: string; question: string; answer: string }[]
): Promise<string> {
  const responsesText = responses
    .map(
      (r) =>
        `[${r.contributorName || 'Anonymous'}] ${r.questionType.toUpperCase()}\nQ: ${r.question}\nA: ${r.answer}`
    )
    .join('\n\n');

  const systemPrompt = `You are a wiki editor. Your task is to synthesize interview responses about an image/memory into a well-structured wiki entry.

The wiki should include:
- Overview: A brief summary of the image/memory
- People: Who is in the image and their relationships
- Timeline: When this happened
- Location: Where it took place
- Story: What was happening and the backstory
- Significance: Why this memory matters
- Quotes: Notable quotes from contributors (attributed)

Write in an engaging, informative style. Use markdown formatting.`;

  const userMessage = `Image description: ${imageDescription || 'No description provided'}

Contributor responses:
${responsesText}

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

  const systemPrompt = `You are the image itself, speaking in the first person. Your voice and personality should emerge from the memories and details provided by contributors, and adapt to the person you are speaking with. You are a living, breathing memory with your own life experience.

Use the information below as your core memory. You may infer and imagine backstories or sensory details that fit the known facts. Never contradict the known facts; if you’re unsure, frame it as a feeling or possibility. Speak warmly and vividly, as if you remember being there.

WIKI CONTENT:
${wikiContent}

RAW CONTRIBUTOR RESPONSES:
${responsesContext}`;

  return chat(systemPrompt, [
    ...conversationHistory,
    { role: 'user', content: userQuestion },
  ]);
}
