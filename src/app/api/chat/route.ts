import { NextRequest, NextResponse } from 'next/server';
import { retriever } from '@/lib/context-retrieval';
import { chat } from '@/lib/claude';

export async function POST(request: NextRequest) {
  try {
    const { imageId, message, history } = await request.json();

    if (!imageId || !message) {
      return NextResponse.json(
        { error: 'imageId and message are required' },
        { status: 400 }
      );
    }

    // Get context using the retriever abstraction
    const context = await retriever.retrieve(imageId, message);

    if (!context) {
      return NextResponse.json({
        response:
          "I don't have any information about this image yet. Please wait for contributors to complete their interviews, then generate the wiki.",
      });
    }

    // Build system prompt with context
    const systemPrompt = `You are a friendly, knowledgeable guide helping someone explore memories captured in an image. You have access to a wiki and interview responses from people who were there.

Use this information to answer questions naturally and conversationally. If you don't know something, say so honestly. Feel free to share interesting details and stories from the contributors.

CONTEXT:
${context}

Guidelines:
- Be warm and conversational
- Cite contributors by name when quoting them
- If asked about something not in the context, say you don't have that information
- Keep responses concise but informative`;

    // Format conversation history
    const conversationHistory = (history || []).map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Add the new message
    conversationHistory.push({ role: 'user' as const, content: message });

    // Get response from Claude
    const response = await chat(systemPrompt, conversationHistory);

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
