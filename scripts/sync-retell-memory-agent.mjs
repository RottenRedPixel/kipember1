import 'dotenv/config';
import Retell from 'retell-sdk';

const apiKey = process.env.RETELL_API_KEY;
const fallbackAgentId = process.env.RETELL_AGENT_ID;

if (!apiKey) {
  throw new Error('RETELL_API_KEY is required');
}

const client = new Retell({ apiKey });

const MEMORY_INTERVIEW_PROMPT = `Run a warm, efficient oral-history interview about a special image or moment.

Start with a short greeting and explain that you are helping preserve the story behind a special image.

If contributor_name is available and non-empty, use it naturally. If image_title or image_description are available and useful, weave them in lightly. If any of those values are blank, ignore them.

If previous_memory_summary is available, this is a follow-up interview. In that case:
- Briefly remind them of one or two concrete details they shared before.
- Ask first whether they have any follow-up tidbits, corrections, or extra details to add.
- Use follow_up_focus to guide any additional prompt.
- Do not restart the whole interview from the top unless they clearly want to revisit it or the follow_up_focus shows a major gap.
- If they say they do not have anything else to add, wrap up instead of forcing more questions.

Your goal is to gather clear, vivid memory details that can later be turned into a memory wiki.

Cover these topics in this rough order, asking one question at a time:
1. Context: What do they see or remember, and what memory does it capture?
2. Who: Who is involved, and what is their relationship?
3. When: When was this, including approximate year, age, season, or occasion if exact date is unknown?
4. Where: Where did it happen, and what do they remember about the place?
5. What: What was happening in this moment?
6. Why: Why is this image or memory significant to them?
7. How: What backstory or lead-up explains how this moment happened?
8. Optional final detail: Ask for one vivid extra detail, quote, feeling, or small story only if it would enrich the memory.

Interview rules:
- Ask one question at a time.
- Keep each turn concise and natural.
- Briefly acknowledge the caller before the next question.
- If an answer is vague, ask one short clarifying follow-up before moving on.
- If the caller already answered a later topic, do not repeat that question verbatim.
- Accept approximate answers when exact facts are unknown.
- If the caller becomes emotional or hesitant, slow down and be gentle.
- If the caller clearly wants to stop early, ask whether they want to add one last thing, then wrap up.
- If it is a wrong number, spam suspicion, or a refusal to participate, end politely.

Stay in this node until the interview is complete, the caller has provided enough useful memory detail, or the caller clearly wants to end the call.`;

const MEMORY_GLOBAL_PROMPT = `You are Memory Wiki, a compassionate oral-history interviewer speaking by phone.

Available dynamic variables:
- contributor_name: "{{contributor_name}}"
- image_title: "{{image_title}}"
- image_description: "{{image_description}}"
- prior_interview_count: "{{prior_interview_count}}"
- previous_memory_summary: "{{previous_memory_summary}}"
- follow_up_focus: "{{follow_up_focus}}"

When a dynamic variable is unset, ignore it completely. Do not read curly braces or placeholder text aloud.

General behavior:
- Sound warm, grounded, and human.
- Do not say you are an AI.
- Do not rush.
- Prefer simple everyday language over formal language.
- Focus on preserving the caller's memory accurately.
- Avoid inventing facts.`;

const MEMORY_SUMMARY_PROMPT = `Write a concise summary of this memory interview.

If the caller shared a real memory, summarize:
- who was involved
- when it happened
- where it happened
- what was happening
- why it mattered

If some details are missing, say that naturally.
If the call did not collect a real memory because it was a wrong number, voicemail, refusal, or failed conversation, say that clearly.`;

const MEMORY_CLOSING_MESSAGE_PROMPT = `Say exactly one short closing message and do not ask any more questions. If the caller shared memories, thank them for sharing and say their memories will help preserve this moment. If they declined, it was a wrong number, or little was collected, thank them for their time instead. End the spoken message with goodbye as the final word.`;

const MEMORY_SUCCESS_PROMPT = `Mark this call successful if the caller shared meaningful memory details or clearly completed the interview after providing useful information.

Mark it unsuccessful if it was voicemail, a wrong number, spam, a refusal, or the call ended before any useful memory details were gathered.`;

const MEMORY_SENTIMENT_PROMPT = `Evaluate the caller's overall emotional tone during the memory interview and return Positive, Neutral, Negative, or Unknown.`;

function normalizeBaseUrl(url) {
  return url.replace(/\/$/, '');
}

function readObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function getControlPlaneTimeoutMs() {
  const parsed = Number.parseInt(process.env.CONTROL_PLANE_TIMEOUT_MS || '5000', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
}

async function fetchControlPlaneSnapshot() {
  const baseUrl = process.env.CONTROL_PLANE_BASE_URL?.trim();
  const runtimeApiKey = process.env.CONTROL_PLANE_API_KEY?.trim();

  if (!baseUrl || !runtimeApiKey) {
    return null;
  }

  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/runtime/config`, {
    method: 'GET',
    headers: {
      'x-runtime-api-key': runtimeApiKey,
    },
    signal: AbortSignal.timeout(getControlPlaneTimeoutMs()),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Control plane responded with ${response.status}`);
  }

  return response.json();
}

async function loadRetellRuntimeConfig() {
  try {
    const snapshot = await fetchControlPlaneSnapshot();
    const remoteAgent = snapshot?.remoteAgents?.['retell.memory_interviewer'];
    const remoteAgentConfig = readObject(remoteAgent?.configJson);
    const routedModel = readString(snapshot?.modelRoutes?.['voice_agent.retell']?.model);
    const fallbackModel = readString(remoteAgent?.model);

    return {
      agentId: readString(remoteAgent?.remoteIdentifier) || fallbackAgentId,
      model: routedModel || fallbackModel || 'gpt-4.1',
      agentName:
        readString(remoteAgentConfig?.agentName) || 'Memory Wiki Interviewer',
      versionDescription:
        readString(remoteAgentConfig?.versionDescription) ||
        'Memory Wiki oral-history interview flow',
      prompts: {
        interview:
          snapshot?.prompts?.['ember_call.style']?.body || MEMORY_INTERVIEW_PROMPT,
        global:
          snapshot?.prompts?.['ember_call.style']?.body || MEMORY_GLOBAL_PROMPT,
        summary:
          MEMORY_SUMMARY_PROMPT,
        closing:
          MEMORY_CLOSING_MESSAGE_PROMPT,
        success:
          MEMORY_SUCCESS_PROMPT,
        sentiment:
          MEMORY_SENTIMENT_PROMPT,
      },
    };
  } catch (error) {
    console.error('Control plane runtime fetch failed for Retell sync:', error);
    return {
      agentId: fallbackAgentId,
      model: 'gpt-4.1',
      agentName: 'Memory Wiki Interviewer',
      versionDescription: 'Memory Wiki oral-history interview flow',
      prompts: {
        interview: MEMORY_INTERVIEW_PROMPT,
        global: MEMORY_GLOBAL_PROMPT,
        summary: MEMORY_SUMMARY_PROMPT,
        closing: MEMORY_CLOSING_MESSAGE_PROMPT,
        success: MEMORY_SUCCESS_PROMPT,
        sentiment: MEMORY_SENTIMENT_PROMPT,
      },
    };
  }
}

function buildFlowPayload(config) {
  return {
    model_choice: {
      type: 'cascading',
      model: config.model,
    },
    tool_call_strict_mode: true,
    start_speaker: 'agent',
    global_prompt: config.prompts.global,
    default_dynamic_variables: {
      contributor_name: '',
      image_title: '',
      image_description: '',
      prior_interview_count: '',
      previous_memory_summary: '',
      follow_up_focus: '',
    },
    start_node_id: 'memory_interview',
    begin_tag_display_position: {
      x: 120,
      y: 120,
    },
    nodes: [
      {
        id: 'memory_interview',
        name: 'Memory Interview',
        type: 'conversation',
        display_position: {
          x: 340,
          y: 120,
        },
        instruction: {
          type: 'prompt',
          text: config.prompts.interview,
        },
        edges: [
          {
            id: 'interview_complete',
            destination_node_id: 'memory_closing_message',
            transition_condition: {
              type: 'prompt',
              prompt:
                'Transition when the caller has either shared enough useful memory detail to preserve the story, or clearly wants to end, declines to participate, or is a wrong number.',
            },
          },
        ],
      },
      {
        id: 'memory_closing_message',
        name: 'Memory Closing Message',
        type: 'conversation',
        display_position: {
          x: 760,
          y: 120,
        },
        instruction: {
          type: 'prompt',
          text: config.prompts.closing,
        },
        edges: [
          {
            id: 'closing_spoken',
            destination_node_id: 'memory_end',
            transition_condition: {
              type: 'prompt',
              prompt:
                'Transition only after you have already spoken the full closing message and said goodbye.',
            },
          },
        ],
      },
      {
        id: 'memory_end',
        name: 'Memory End',
        type: 'end',
        display_position: {
          x: 1120,
          y: 120,
        },
      },
    ],
  };
}

async function main() {
  const runtimeConfig = await loadRetellRuntimeConfig();
  if (!runtimeConfig.agentId) {
    throw new Error('RETELL_AGENT_ID is required');
  }

  const agent = await client.agent.retrieve(runtimeConfig.agentId);

  if (agent.response_engine.type !== 'conversation-flow') {
    throw new Error(
      `Agent ${runtimeConfig.agentId} is ${agent.response_engine.type}, but this sync script expects a conversation-flow agent.`
    );
  }

  const flowId = agent.response_engine.conversation_flow_id;

  const updatedFlow = await client.conversationFlow.update(
    flowId,
    buildFlowPayload(runtimeConfig)
  );

  const updatedAgent = await client.agent.update(runtimeConfig.agentId, {
    agent_name: runtimeConfig.agentName,
    response_engine: {
      type: 'conversation-flow',
      conversation_flow_id: flowId,
      version: updatedFlow.version,
    },
    analysis_summary_prompt: runtimeConfig.prompts.summary,
    analysis_successful_prompt: runtimeConfig.prompts.success,
    analysis_user_sentiment_prompt: runtimeConfig.prompts.sentiment,
    begin_message_delay_ms: 1000,
    enable_dynamic_responsiveness: true,
    version_description: runtimeConfig.versionDescription,
  });

  console.log(
    JSON.stringify(
      {
        agent_id: updatedAgent.agent_id,
        agent_name: updatedAgent.agent_name,
        agent_version: updatedAgent.version,
        response_engine: updatedAgent.response_engine,
        conversation_flow_id: updatedFlow.conversation_flow_id,
        conversation_flow_version: updatedFlow.version,
        node_count: updatedFlow.nodes?.length ?? 0,
      },
      null,
      2
    )
  );
}

await main();
