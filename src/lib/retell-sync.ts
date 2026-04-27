import Retell from 'retell-sdk';
import { getControlPlaneSnapshot, getPromptBody } from '@/lib/control-plane';

type ConversationFlowUpdateParams = Parameters<
  InstanceType<typeof Retell>['conversationFlow']['update']
>[1];

type RetellRuntimeConfig = {
  agentId: string;
  model: string;
  agentName: string;
  versionDescription: string;
  prompts: {
    interview: string;
    global: string;
    summary: string;
    closing: string;
    success: string;
    sentiment: string;
  };
};

function readObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

async function loadRetellRuntimeConfig(): Promise<RetellRuntimeConfig> {
  const fallbackAgentId = readString(process.env.RETELL_AGENT_ID);

  const [snapshot, callPrompt] = await Promise.all([
    getControlPlaneSnapshot(),
    getPromptBody('ember_call.style'),
  ]);

  const remoteAgent = snapshot?.remoteAgents?.['retell.memory_interviewer'];
  const remoteAgentConfig = readObject(remoteAgent?.configJson);
  const routedModel = readString(snapshot?.modelRoutes?.['voice_agent.retell']?.model);
  const fallbackModel = readString(remoteAgent?.model);

  if (!callPrompt) {
    throw new Error('ember_call.style has no body');
  }

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
      closing: callPrompt,
      success: callPrompt,
      sentiment: callPrompt,
    },
  };
}

function buildFlowPayload(config: RetellRuntimeConfig): ConversationFlowUpdateParams {
  const payload = {
    model_choice: {
      type: 'cascading' as const,
      model: config.model,
    },
    tool_call_strict_mode: true,
    start_speaker: 'agent' as const,
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
    begin_tag_display_position: { x: 120, y: 120 },
    nodes: [
      {
        id: 'memory_interview',
        name: 'Memory Interview',
        type: 'conversation' as const,
        display_position: { x: 340, y: 120 },
        instruction: { type: 'prompt' as const, text: config.prompts.interview },
        edges: [
          {
            id: 'interview_complete',
            destination_node_id: 'memory_closing_message',
            transition_condition: {
              type: 'prompt' as const,
              prompt: config.prompts.global,
            },
          },
        ],
      },
      {
        id: 'memory_closing_message',
        name: 'Memory Closing Message',
        type: 'conversation' as const,
        display_position: { x: 760, y: 120 },
        instruction: { type: 'prompt' as const, text: config.prompts.closing },
        edges: [
          {
            id: 'closing_spoken',
            destination_node_id: 'memory_end',
            transition_condition: {
              type: 'prompt' as const,
              prompt: config.prompts.global,
            },
          },
        ],
      },
      {
        id: 'memory_end',
        name: 'Memory End',
        type: 'end' as const,
        display_position: { x: 1120, y: 120 },
      },
    ],
  };
  return payload as ConversationFlowUpdateParams;
}

export type RetellSyncResult = {
  agentId: string;
  agentVersion: number;
  conversationFlowId: string;
  conversationFlowVersion: number;
};

export async function syncRetellAgent(): Promise<RetellSyncResult> {
  const apiKey = readString(process.env.RETELL_API_KEY);
  if (!apiKey) {
    throw new Error('RETELL_API_KEY is required');
  }

  const runtimeConfig = await loadRetellRuntimeConfig();
  if (!runtimeConfig.agentId) {
    throw new Error('RETELL_AGENT_ID is required');
  }

  const client = new Retell({ apiKey });
  const agent = await client.agent.retrieve(runtimeConfig.agentId);

  if (agent.response_engine.type !== 'conversation-flow') {
    throw new Error(
      `Agent ${runtimeConfig.agentId} is ${agent.response_engine.type}, but the sync expects a conversation-flow agent.`
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

  return {
    agentId: updatedAgent.agent_id,
    agentVersion: updatedAgent.version,
    conversationFlowId: updatedFlow.conversation_flow_id,
    conversationFlowVersion: updatedFlow.version,
  };
}

export const RETELL_PROMPT_KEYS = new Set<string>(['ember_call.style']);
