import 'dotenv/config';
import Retell from 'retell-sdk';

const apiKey = process.env.RETELL_API_KEY;
const fallbackAgentId = process.env.RETELL_AGENT_ID;

if (!apiKey) {
  throw new Error('RETELL_API_KEY is required');
}

const client = new Retell({ apiKey });

function normalizeBaseUrl(url) {
  return url.replace(/\/$/, '');
}

function readObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function requirePrompt(snapshot, promptKey) {
  const body = readString(snapshot?.prompts?.[promptKey]?.body);
  if (!body) {
    throw new Error(`Missing required runtime prompt ${promptKey}`);
  }
  return body;
}

function getControlPlaneTimeoutMs() {
  const parsed = Number.parseInt(process.env.CONTROL_PLANE_TIMEOUT_MS || '5000', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
}

async function fetchControlPlaneSnapshot() {
  const baseUrl = process.env.CONTROL_PLANE_BASE_URL?.trim();
  const runtimeApiKey = process.env.CONTROL_PLANE_API_KEY?.trim();

  if (!baseUrl || !runtimeApiKey) {
    throw new Error('CONTROL_PLANE_BASE_URL and CONTROL_PLANE_API_KEY are required');
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

    const callPrompt = requirePrompt(snapshot, 'ember_call.style');
    const closingPrompt = requirePrompt(snapshot, 'ember_call.closing');

    return {
      agentId: readString(remoteAgent?.remoteIdentifier) || fallbackAgentId,
      model: routedModel || fallbackModel || 'gpt-4.1',
      agentName:
        readString(remoteAgentConfig?.agentName) || 'Memory Wiki Interviewer',
      versionDescription:
        readString(remoteAgentConfig?.versionDescription) ||
        'Memory Wiki oral-history interview flow',
      prompts: {
        interview: callPrompt,
        global: callPrompt,
        summary: callPrompt,
        closing: closingPrompt,
        success: callPrompt,
        sentiment: callPrompt,
      },
    };
  } catch (error) {
    console.error('Control plane runtime fetch failed for Retell sync:', error);
    throw error;
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
              prompt: config.prompts.global,
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
              prompt: config.prompts.global,
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
