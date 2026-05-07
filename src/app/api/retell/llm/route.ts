// Custom LLM endpoint for Retell agents in `custom-llm` mode.
//
// Retell POSTs an OpenAI-compatible streaming chat completions request
// to this URL on every conversation turn. Body shape (Retell adds extras
// like `call`):
//
//   {
//     model: string,
//     stream: true,
//     messages: [{ role: 'user' | 'assistant' | 'system', content: string }],
//     call: { call_id, retell_llm_dynamic_variables, metadata, ... },
//     ...
//   }
//
// We respond with Server-Sent Events in OpenAI chat.completion.chunk
// format: a stream of `data: { ... }` lines ending with `data: [DONE]`.
//
// On every turn we re-load the ember context from the DB (wiki, tagged
// people, location, claims) so prompts always see the freshest state —
// unlike the conversation-flow agent which freezes context at call start.
//
// ROLE DETECTION (in priority order):
//   1. ?role=owner|contributor  query param baked into the Retell agent's LLM URL
//   2. metadata.initiatedBy     passed at call-start by voice-calls.ts (fallback)
//
// Retell agent LLM URLs should be:
//   Owner agent:       .../api/retell/llm?role=owner
//   Contributor agent: .../api/retell/llm?role=contributor

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  PROMPT_REMOVED_MESSAGE,
  isPromptRemovedError,
  renderPromptTemplate,
} from '@/lib/control-plane';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';
const MAX_TOKENS = 150;

type RetellMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type RetellRequest = {
  model?: string;
  stream?: boolean;
  messages?: RetellMessage[];
  call?: {
    call_id?: string;
    retell_llm_dynamic_variables?: Record<string, string>;
    metadata?: Record<string, string>;
    transcript?: Array<{ role: 'user' | 'agent'; content: string }>;
  };
};

function sseChunk(id: string, model: string, content: string) {
  const payload = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: { content }, finish_reason: null as null | string }],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function sseFinal(id: string, model: string) {
  const payload = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
  };
  return `data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`;
}

export async function POST(request: NextRequest) {
  let body: RetellRequest;
  try {
    body = (await request.json()) as RetellRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const dynamicVars = body.call?.retell_llm_dynamic_variables ?? {};
  const metadata = body.call?.metadata ?? {};
  const imageId = metadata.imageId || dynamicVars.image_id || '';

  // Determine role: URL query param takes priority (set per-agent in Retell),
  // falling back to metadata.initiatedBy for backward compatibility.
  const roleParam = request.nextUrl.searchParams.get('role'); // 'owner' | 'contributor'
  const role = roleParam === 'owner' || roleParam === 'contributor'
    ? roleParam
    : (metadata.initiatedBy === 'owner' ? 'owner' : 'contributor');
  const promptKey = role === 'owner'
    ? 'ember_call.owner_style'
    : 'ember_call.contributor_style';

  // Load fresh ember context for this turn. Falling back to whatever Retell
  // sent in dynamic variables means a missing imageId still gets a usable
  // prompt — the wiki text just won't refresh during the call.
  let renderedSystemPrompt = '';
  try {
    // All wiki/context data is pre-loaded at call-start and passed as dynamic
    // variables — no DB round-trip needed on each turn, which reduces latency.
    renderedSystemPrompt = await renderPromptTemplate(
      promptKey,
      '',
      {
        contributor_name: dynamicVars.contributor_name ?? '',
        image_title: dynamicVars.image_title ?? '',
        image_description: dynamicVars.image_description ?? '',
        captured_at: dynamicVars.captured_at ?? '',
        tagged_people: dynamicVars.tagged_people ?? '',
        location: dynamicVars.location ?? '',
        claims: dynamicVars.claims ?? '',
        wiki: dynamicVars.wiki ?? '',
        previous_memory_summary: dynamicVars.previous_memory_summary ?? '',
        follow_up_focus: dynamicVars.follow_up_focus ?? '',
        prior_interview_count: dynamicVars.prior_interview_count ?? '',
      }
    );
  } catch (error) {
    if (isPromptRemovedError(error)) {
      return new Response(JSON.stringify({ error: PROMPT_REMOVED_MESSAGE }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('Custom LLM prompt render failed:', error);
    return new Response(JSON.stringify({ error: 'Prompt render failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Filter the OpenAI-style messages array down to just user/assistant
  // turns; system content lives in our rendered prompt above.
  const claudeMessages = (body.messages ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0);

  // Anthropic requires the conversation to start with a user turn. If the
  // call just began and Retell hasn't sent any user input yet (greeting
  // turn), seed a dummy user turn so the agent introduces itself.
  if (claudeMessages.length === 0 || claudeMessages[0].role !== 'user') {
    claudeMessages.unshift({ role: 'user', content: '[call started]' });
  }

  const model = body.model || DEFAULT_MODEL;
  const responseId = `chatcmpl-${body.call?.call_id ?? Date.now()}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = await anthropic.messages.stream({
          model,
          max_tokens: MAX_TOKENS,
          system: renderedSystemPrompt,
          messages: claudeMessages,
        });

        for await (const event of claudeStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(sseChunk(responseId, model, event.delta.text)));
          }
        }

        controller.enqueue(encoder.encode(sseFinal(responseId, model)));
      } catch (error) {
        console.error('Custom LLM stream error:', error);
        // Send a graceful fallback so Retell speaks something instead of silence.
        controller.enqueue(
          encoder.encode(sseChunk(responseId, model, "Sorry, I'm having trouble right now."))
        );
        controller.enqueue(encoder.encode(sseFinal(responseId, model)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
