import type Retell from 'retell-sdk';
import { chat } from '@/lib/claude';
import { prisma } from '@/lib/db';
import { createRetellPhoneCall, retrieveRetellCall } from '@/lib/retell';

const QUESTION_PROMPTS = {
  context: 'Can you describe what you see or what memory this image captures for you?',
  who: "Who are the people in this image? What's your relationship to them?",
  when: 'When was this taken? Do you remember the date, year, or occasion?',
  where: 'Where was this? What do you remember about the location?',
  what: 'What was happening at this moment? Any specific events or activities?',
  why: 'Why is this image or memory significant to you?',
  how: 'How did this moment come about? Any backstory?',
} as const;

type QuestionType = keyof typeof QUESTION_PROMPTS;

type ExtractedInterview = {
  isComplete: boolean;
  summary: string;
  responses: Array<{
    questionType: QuestionType;
    answer: string;
  }>;
};

type RetellWebhookPayload = {
  event?: unknown;
  event_type?: unknown;
  call?: unknown;
  data?: {
    call?: unknown;
  };
};

const ACTIVE_CALL_STATUSES = new Set(['registered', 'ongoing']);
const ACTIVE_CALL_WINDOW_MS = 30 * 60 * 1000;

function stringifyJson(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function toDate(timestampMs: number | undefined): Date | undefined {
  if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs)) {
    return undefined;
  }

  return new Date(timestampMs);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asPhoneCallResponse(value: unknown): Retell.PhoneCallResponse | null {
  const record = asRecord(value);
  if (!record || record.call_type !== 'phone_call' || typeof record.call_id !== 'string') {
    return null;
  }

  return value as Retell.PhoneCallResponse;
}

function getEventType(payload: RetellWebhookPayload): string {
  if (typeof payload.event === 'string') {
    return payload.event;
  }

  if (typeof payload.event_type === 'string') {
    return payload.event_type;
  }

  throw new Error('Retell webhook did not include an event type');
}

function getPhoneCallFromPayload(payload: RetellWebhookPayload): Retell.PhoneCallResponse {
  const directCall = asPhoneCallResponse(payload.call);
  if (directCall) {
    return directCall;
  }

  const nestedCall = asPhoneCallResponse(payload.data?.call);
  if (nestedCall) {
    return nestedCall;
  }

  throw new Error('Retell webhook did not include a phone call payload');
}

function getStringMetadata(call: Retell.PhoneCallResponse): Record<string, string> {
  const metadata = asRecord(call.metadata);
  if (!metadata) {
    return {};
  }

  const entries = Object.entries(metadata).flatMap(([key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      return [[key, value.trim()] as const];
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return [[key, String(value)] as const];
    }

    return [];
  });

  return Object.fromEntries(entries);
}

function pickDynamicVariables(input: Record<string, string | null | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) => {
      if (typeof value === 'string' && value.trim()) {
        return [[key, value.trim()] as const];
      }

      return [];
    })
  );
}

async function ensureConversation(contributorId: string, conversationId?: string | null) {
  if (conversationId) {
    const existing = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (existing) {
      return existing;
    }
  }

  const existingForContributor = await prisma.conversation.findUnique({
    where: { contributorId },
  });

  if (existingForContributor) {
    return existingForContributor;
  }

  return prisma.conversation.create({
    data: {
      contributorId,
      currentStep: 'context',
      status: 'active',
    },
  });
}

function extractJsonObject(text: string): string {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('Expected a JSON object in Claude response');
  }

  return text.slice(firstBrace, lastBrace + 1);
}

async function extractInterviewFromTranscript(transcript: string): Promise<ExtractedInterview> {
  const systemPrompt = `You convert a phone interview transcript about a personal memory into structured answers for a memory archive.

Return ONLY valid JSON with this exact shape:
{
  "isComplete": true,
  "summary": "1-2 sentence summary",
  "responses": [
    { "questionType": "context", "answer": "..." },
    { "questionType": "who", "answer": "..." }
  ]
}

Rules:
- Only use questionType values from: context, who, when, where, what, why, how
- Extract only information the human contributor actually provided
- Ignore filler, greetings, and agent instructions
- Merge repeated details into one concise answer per questionType
- Omit question types with no meaningful answer
- Mark isComplete true only if the interview covers most of the story in a useful way
- Do not invent facts`;

  const responseText = await chat(systemPrompt, [
    {
      role: 'user',
      content: `Transcript:\n${transcript}`,
    },
  ]);

  const parsed = JSON.parse(extractJsonObject(responseText)) as Partial<ExtractedInterview>;

  const responses = Array.isArray(parsed.responses)
    ? parsed.responses.flatMap((item) => {
        if (
          !item ||
          typeof item !== 'object' ||
          typeof item.questionType !== 'string' ||
          typeof item.answer !== 'string'
        ) {
          return [];
        }

        if (!(item.questionType in QUESTION_PROMPTS) || !item.answer.trim()) {
          return [];
        }

        return [
          {
            questionType: item.questionType as QuestionType,
            answer: item.answer.trim(),
          },
        ];
      })
    : [];

  return {
    isComplete: parsed.isComplete === true,
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    responses,
  };
}

async function upsertVoiceCallRecord(
  call: Retell.PhoneCallResponse,
  eventType: string,
  rawPayload: unknown
) {
  const metadata = getStringMetadata(call);
  const contributorId = metadata.contributorId;
  const conversationId = metadata.conversationId;
  const initiatedBy = metadata.initiatedBy ?? 'system';

  if (!contributorId) {
    throw new Error('Voice call metadata is missing contributorId');
  }

  const existing = await prisma.voiceCall.findUnique({
    where: { retellCallId: call.call_id },
  });

  const baseData = {
    contributorId,
    conversationId: conversationId || null,
    initiatedBy,
    retellCallId: call.call_id,
    callType: call.call_type,
    direction: call.direction,
    fromNumber: call.from_number,
    toNumber: call.to_number,
    agentId: call.agent_id,
    agentVersion: call.agent_version,
    status: call.call_status,
    lastEventType: eventType,
    disconnectionReason: call.disconnection_reason ?? null,
    recordingUrl: call.recording_url ?? null,
    publicLogUrl: call.public_log_url ?? null,
    transcript: call.transcript ?? null,
    transcriptObjectJson: stringifyJson(call.transcript_object),
    transcriptWithToolCallsJson: stringifyJson(call.transcript_with_tool_calls),
    metadataJson: stringifyJson(call.metadata),
    dynamicVariablesJson: stringifyJson(call.retell_llm_dynamic_variables),
    callAnalysisJson: stringifyJson(call.call_analysis),
    callSummary: call.call_analysis?.call_summary ?? null,
    callSuccessful: call.call_analysis?.call_successful ?? null,
    durationMs: call.duration_ms ?? null,
    startedAt: toDate(call.start_timestamp),
    endedAt: toDate(call.end_timestamp),
    analyzedAt: eventType === 'call_analyzed' ? new Date() : existing?.analyzedAt ?? null,
  };

  const voiceCall = existing
    ? await prisma.voiceCall.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          conversationId: baseData.conversationId || existing.conversationId,
          initiatedBy: existing.initiatedBy || initiatedBy,
        },
      })
    : await prisma.voiceCall.create({
        data: baseData,
      });

  await prisma.voiceCallEvent.create({
    data: {
      voiceCallId: voiceCall.id,
      eventType,
      payloadJson: stringifyJson(rawPayload) || '{}',
    },
  });

  return voiceCall;
}

async function syncVoiceCallToConversation(voiceCallId: string) {
  const voiceCall = await prisma.voiceCall.findUnique({
    where: { id: voiceCallId },
    include: {
      contributor: true,
    },
  });

  if (!voiceCall || voiceCall.memorySyncedAt || !voiceCall.transcript?.trim()) {
    return;
  }

  const conversation = await ensureConversation(
    voiceCall.contributorId,
    voiceCall.conversationId
  );

  const extracted = await extractInterviewFromTranscript(voiceCall.transcript);

  if (extracted.responses.length > 0) {
    await prisma.response.createMany({
      data: extracted.responses.map((item) => ({
        conversationId: conversation.id,
        questionType: item.questionType,
        question: QUESTION_PROMPTS[item.questionType],
        answer: item.answer,
        source: 'voice',
      })),
    });
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: extracted.isComplete ? 'completed' : 'active',
      currentStep: extracted.isComplete ? 'completed' : conversation.currentStep,
    },
  });

  await prisma.voiceCall.update({
    where: { id: voiceCall.id },
    data: {
      conversationId: conversation.id,
      callSummary: extracted.summary || voiceCall.callSummary,
      memorySyncedAt: new Date(),
    },
  });
}

export async function startVoiceCallForContributor({
  contributorId,
  initiatedBy,
}: {
  contributorId: string;
  initiatedBy: 'owner' | 'contributor';
}) {
  const contributor = await prisma.contributor.findUnique({
    where: { id: contributorId },
    include: {
      image: true,
      conversation: true,
      voiceCalls: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!contributor) {
    throw new Error('Contributor not found');
  }

  const latestCall = contributor.voiceCalls[0];
  if (
    latestCall &&
    ACTIVE_CALL_STATUSES.has(latestCall.status) &&
    Date.now() - latestCall.createdAt.getTime() < ACTIVE_CALL_WINDOW_MS
  ) {
    throw new Error('A voice call is already being started or is in progress');
  }

  const conversation = await ensureConversation(
    contributor.id,
    contributor.conversation?.id
  );

  const dynamicVariables = pickDynamicVariables({
    contributor_name: contributor.name,
    image_title: contributor.image.originalName,
    image_description: contributor.image.description,
  });

  const call = await createRetellPhoneCall({
    toNumber: contributor.phoneNumber,
    metadata: {
      contributorId: contributor.id,
      conversationId: conversation.id,
      imageId: contributor.imageId,
      initiatedBy,
    },
    dynamicVariables,
  });

  const voiceCall = await prisma.voiceCall.create({
    data: {
      contributorId: contributor.id,
      conversationId: conversation.id,
      initiatedBy,
      retellCallId: call.call_id,
      callType: call.call_type,
      direction: call.direction,
      fromNumber: call.from_number,
      toNumber: call.to_number,
      agentId: call.agent_id,
      agentVersion: call.agent_version,
      status: call.call_status,
      metadataJson: stringifyJson(call.metadata),
      dynamicVariablesJson: stringifyJson(call.retell_llm_dynamic_variables),
      startedAt: toDate(call.start_timestamp),
    },
  });

  return {
    voiceCallId: voiceCall.id,
    retellCallId: voiceCall.retellCallId,
    status: voiceCall.status,
  };
}

export async function processRetellWebhook(rawPayload: unknown) {
  const payload = rawPayload as RetellWebhookPayload;
  const eventType = getEventType(payload);
  const webhookCall = getPhoneCallFromPayload(payload);

  const latestCallResponse =
    eventType === 'call_ended' || eventType === 'call_analyzed'
      ? await retrieveRetellCall(webhookCall.call_id).catch(() => webhookCall)
      : webhookCall;

  const phoneCall = asPhoneCallResponse(latestCallResponse);
  if (!phoneCall) {
    throw new Error('Retell webhook did not resolve to a phone call');
  }

  const voiceCall = await upsertVoiceCallRecord(phoneCall, eventType, rawPayload);

  if (eventType === 'call_analyzed') {
    await syncVoiceCallToConversation(voiceCall.id);
  }

  return voiceCall;
}
