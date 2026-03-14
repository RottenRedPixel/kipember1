import 'dotenv/config';
import Retell from 'retell-sdk';

const apiKey = process.env.RETELL_API_KEY;
const agentId = process.env.RETELL_AGENT_ID;

if (!apiKey) {
  throw new Error('RETELL_API_KEY is required');
}

if (!agentId) {
  throw new Error('RETELL_AGENT_ID is required');
}

const client = new Retell({ apiKey });

const MEMORY_INTERVIEW_PROMPT = `Run a warm, efficient oral-history interview about a special image or moment.

Start with a short greeting and explain that you are helping preserve the story behind a special image.

If contributor_name is available and non-empty, use it naturally. If image_title or image_description are available and useful, weave them in lightly. If any of those values are blank, ignore them.

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

const MEMORY_SUCCESS_PROMPT = `Mark this call successful if the caller shared meaningful memory details or clearly completed the interview after providing useful information.

Mark it unsuccessful if it was voicemail, a wrong number, spam, a refusal, or the call ended before any useful memory details were gathered.`;

const MEMORY_SENTIMENT_PROMPT = `Evaluate the caller's overall emotional tone during the memory interview and return Positive, Neutral, Negative, or Unknown.`;

function buildFlowPayload() {
  return {
    model_choice: {
      type: 'cascading',
      model: 'gpt-4.1',
    },
    tool_call_strict_mode: true,
    start_speaker: 'agent',
    global_prompt: MEMORY_GLOBAL_PROMPT,
    default_dynamic_variables: {
      contributor_name: '',
      image_title: '',
      image_description: '',
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
          text: MEMORY_INTERVIEW_PROMPT,
        },
        edges: [
          {
            id: 'interview_complete',
            destination_node_id: 'memory_end',
            transition_condition: {
              type: 'prompt',
              prompt:
                'Transition when the caller has either shared enough useful memory detail to preserve the story, or clearly wants to end, declines to participate, or is a wrong number.',
            },
          },
        ],
      },
      {
        id: 'memory_end',
        name: 'Memory Closing',
        type: 'end',
        display_position: {
          x: 760,
          y: 120,
        },
        instruction: {
          type: 'prompt',
          text:
            'End the call with a short final closing. If the caller shared memories, thank them for sharing and say their memories will help preserve this moment. If they declined, it was a wrong number, or little was collected, thank them for their time instead. In every case, explicitly say goodbye as the final phrase of the call.',
        },
      },
    ],
  };
}

async function main() {
  const agent = await client.agent.retrieve(agentId);

  if (agent.response_engine.type !== 'conversation-flow') {
    throw new Error(
      `Agent ${agentId} is ${agent.response_engine.type}, but this sync script expects a conversation-flow agent.`
    );
  }

  const flowId = agent.response_engine.conversation_flow_id;

  const updatedFlow = await client.conversationFlow.update(
    flowId,
    buildFlowPayload()
  );

  const updatedAgent = await client.agent.update(agentId, {
    agent_name: 'Memory Wiki Interviewer',
    response_engine: {
      type: 'conversation-flow',
      conversation_flow_id: flowId,
      version: updatedFlow.version,
    },
    analysis_summary_prompt: MEMORY_SUMMARY_PROMPT,
    analysis_successful_prompt: MEMORY_SUCCESS_PROMPT,
    analysis_user_sentiment_prompt: MEMORY_SENTIMENT_PROMPT,
    begin_message_delay_ms: 1000,
    enable_dynamic_responsiveness: true,
    version_description: 'Memory Wiki oral-history interview flow',
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
