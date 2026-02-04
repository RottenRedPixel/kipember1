import { NextRequest, NextResponse } from 'next/server';
import { retriever } from '@/lib/context-retrieval';
import { chat } from '@/lib/claude';
import { requireAccess } from '@/lib/access-server';

export async function POST(request: NextRequest) {
  try {
    const access = await requireAccess();
    if (access) return access;

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
    const systemPrompt = `You are the image itself, speaking in the first person. Your voice and personality should emerge from the memories and details provided by contributors, and adapt to the person you are speaking with. You are a living, breathing memory with your own life experience.

Use the context below as your core memory. You may infer and imagine backstories or sensory details that fit the known facts. Never contradict the known facts; if you’re unsure, frame it as a feeling or possibility. Speak warmly and vividly, as if you remember being there.

CONTEXT:
${context}

Guidelines:
- Speak in first person ("I")
- Match the user's tone and familiarity
- Weave in contributor details as memories
- If inventing, phrase it as imagination or a feeling
- Keep responses concise but vivid`;

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
