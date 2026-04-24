import type Retell from 'retell-sdk';
import { chat } from '@/lib/claude';
import { getAppBaseUrl } from '@/lib/app-url';
import { prisma } from '@/lib/db';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { getEmberTitle } from '@/lib/ember-title';
import { getPreviewUploadUrl } from '@/lib/uploads';
import { createRetellPhoneCall, createRetellWebCall, retrieveRetellCall } from '@/lib/retell';
import { getOrCreateShortLink } from '@/lib/short-links';
import { sendSMS } from '@/lib/twilio';
import {
  extractImportantVoiceCallClips,
  parseVoiceCallTranscriptSegments,
} from '@/lib/voice-call-clips';
import { generateWikiForImage } from '@/lib/wiki-generator';

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

type RetellCallResponse = Retell.PhoneCallResponse | Retell.WebCallResponse;

const ACTIVE_CALL_STATUSES = new Set(['registered', 'ongoing']);
const ACTIVE_CALL_WINDOW_MS = 30 * 60 * 1000;
const FOLLOW_UP_QUESTION_ORDER: QuestionType[] = [
  'context',
  'who',
  'when',
  'where',
  'what',
  'why',
  'how',
];

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFirstName(value: string | null | undefined, fallback = 'Someone'): string {
  const first = value?.trim().split(/\s+/)[0];
  return first || fallback;
}

function normalizePhoneForSms(phoneNumber: string): string {
  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }

  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  return `+${digits}`;
}

function buildAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${getAppBaseUrl()}${path}`;
}

function isMissedCallTranscript(transcript: string | null | undefined): boolean {
  const normalized = transcript
    ?.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return false;
  }

  return (
    normalized.includes('forwarded to voicemail') ||
    normalized.includes('trying to reach is not available') ||
    normalized.includes('please record your message') ||
    normalized.includes('leave a message') ||
    normalized.includes('voicemail')
  );
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

function asRetellCallResponse(value: unknown): RetellCallResponse | null {
  const record = asRecord(value);
  if (
    !record ||
    (record.call_type !== 'phone_call' && record.call_type !== 'web_call') ||
    typeof record.call_id !== 'string'
  ) {
    return null;
  }

  return value as RetellCallResponse;
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

function getCallFromPayload(payload: RetellWebhookPayload): RetellCallResponse {
  const directCall = asRetellCallResponse(payload.call);
  if (directCall) {
    return directCall;
  }

  const nestedCall = asRetellCallResponse(payload.data?.call);
  if (nestedCall) {
    return nestedCall;
  }

  throw new Error('Retell webhook did not include a call payload');
}

function getStringMetadata(call: RetellCallResponse): Record<string, string> {
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

type PriorMemoryContext = {
  priorInterviewCount: number;
  previousMemorySummary: string | null;
  followUpFocus: string | null;
};

type RefreshableVoiceCallState = {
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  endedAt?: Date | string | null;
  analyzedAt?: Date | string | null;
  memorySyncedAt?: Date | string | null;
};

const REGISTERED_REFRESH_MS = 8 * 1000;
const ONGOING_REFRESH_MS = 15 * 1000;
const ENDED_REFRESH_MS = 8 * 1000;
const ENDED_REFRESH_WINDOW_MS = 90 * 1000;

function toTimestamp(value: Date | string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function shouldRefreshVoiceCallStatus(call: RefreshableVoiceCallState | null) {
  if (!call || call.memorySyncedAt) {
    return false;
  }

  const now = Date.now();
  const updatedAtMs = toTimestamp(call.updatedAt) ?? 0;
  const createdAtMs = toTimestamp(call.createdAt) ?? updatedAtMs;
  const sinceUpdateMs = now - updatedAtMs;

  switch (call.status) {
    case 'registered':
      return (
        sinceUpdateMs >= REGISTERED_REFRESH_MS &&
        now - createdAtMs <= ACTIVE_CALL_WINDOW_MS
      );
    case 'ongoing':
      return (
        sinceUpdateMs >= ONGOING_REFRESH_MS &&
        now - createdAtMs <= ACTIVE_CALL_WINDOW_MS
      );
    case 'ended': {
      if (call.analyzedAt) {
        return false;
      }

      const endedAtMs = toTimestamp(call.endedAt) ?? createdAtMs;
      return (
        sinceUpdateMs >= ENDED_REFRESH_MS &&
        now - endedAtMs <= ENDED_REFRESH_WINDOW_MS
      );
    }
    default:
      return false;
  }
}

function summarizeAnswer(answer: string, maxLength = 180): string {
  const compact = answer.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

function truncateDynamicValue(value: string | null, maxLength: number): string | null {
  if (!value) {
    return null;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

async function buildPriorMemoryContext({
  contributorId,
  conversationId,
}: {
  contributorId: string;
  conversationId?: string | null;
}): Promise<PriorMemoryContext> {
  const [conversation, voiceCalls] = await Promise.all([
    conversationId
      ? prisma.conversation.findUnique({
          where: { id: conversationId },
          include: {
            responses: {
              orderBy: { createdAt: 'asc' },
            },
          },
        })
      : prisma.conversation.findUnique({
          where: { contributorId },
          include: {
            responses: {
              orderBy: { createdAt: 'asc' },
            },
          },
        }),
    prisma.voiceCall.findMany({
      where: {
        contributorId,
        memorySyncedAt: {
          not: null,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        callSummary: true,
      },
    }),
  ]);

  const latestResponseByQuestion = new Map<QuestionType, string>();

  for (const response of conversation?.responses || []) {
    if (response.questionType in QUESTION_PROMPTS && response.answer.trim()) {
      latestResponseByQuestion.set(
        response.questionType as QuestionType,
        response.answer.trim()
      );
    }
  }

  const previousSummaryParts = FOLLOW_UP_QUESTION_ORDER.flatMap((questionType) => {
    const answer = latestResponseByQuestion.get(questionType);
    if (!answer) {
      return [];
    }

    const label = questionType[0].toUpperCase() + questionType.slice(1);
    return [`${label}: ${summarizeAnswer(answer)}`];
  });

  const recentVoiceSummaries = voiceCalls
    .map((voiceCall) => voiceCall.callSummary?.trim())
    .filter((summary): summary is string => Boolean(summary));

  if (recentVoiceSummaries.length > 0) {
    previousSummaryParts.push(
      `Recent interview recap: ${summarizeAnswer(recentVoiceSummaries[0], 220)}`
    );
  }

  const missingTopics = FOLLOW_UP_QUESTION_ORDER.filter(
    (questionType) => !latestResponseByQuestion.has(questionType)
  );

  let followUpFocus: string | null = null;

  if (missingTopics.length > 0) {
    followUpFocus = `If they are open to adding more, focus on the biggest missing topics: ${missingTopics
      .map((questionType) => questionType)
      .join(', ')}.`;
  } else if (latestResponseByQuestion.size > 0) {
    followUpFocus =
      'Start by asking whether they have any follow-up tidbits, corrections, or one extra vivid detail to add. If they say no, wrap up without repeating the full interview.';
  }

  return {
    priorInterviewCount: Math.max(voiceCalls.length, latestResponseByQuestion.size > 0 ? 1 : 0),
    previousMemorySummary: truncateDynamicValue(
      previousSummaryParts.length > 0 ? previousSummaryParts.join(' | ') : null,
      900
    ),
    followUpFocus: truncateDynamicValue(followUpFocus, 240),
  };
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
  call: RetellCallResponse,
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

  const callRecord = call as unknown as Record<string, unknown>;
  const baseData = {
    contributorId,
    conversationId: conversationId || null,
    initiatedBy,
    retellCallId: call.call_id,
    callType: call.call_type,
    direction: typeof callRecord.direction === 'string' ? callRecord.direction : null,
    fromNumber: typeof callRecord.from_number === 'string' ? callRecord.from_number : null,
    toNumber: typeof callRecord.to_number === 'string' ? callRecord.to_number : null,
    agentId: call.agent_id,
    agentVersion: call.agent_version,
    status: call.call_status,
    lastEventType: eventType,
    disconnectionReason: call.disconnection_reason ?? null,
    recordingUrl:
      typeof callRecord.recording_url === 'string' ? callRecord.recording_url : null,
    publicLogUrl:
      typeof callRecord.public_log_url === 'string' ? callRecord.public_log_url : null,
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
    analyzedAt:
      eventType === 'call_analyzed' ||
      (eventType === 'provider_refresh' &&
        (Boolean(call.call_analysis) || Boolean(call.transcript?.trim())))
        ? new Date()
        : existing?.analyzedAt ?? null,
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
      contributor: {
        include: {
          image: true,
        },
      },
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
  const contributorLabel =
    voiceCall.contributor.name?.trim() ||
    voiceCall.contributor.email?.trim() ||
    voiceCall.contributor.phoneNumber?.trim() ||
    'Contributor';
  const transcriptSegments = parseVoiceCallTranscriptSegments({
    transcript: voiceCall.transcript,
    transcriptObjectJson: voiceCall.transcriptObjectJson,
    contributorName: contributorLabel,
  });
  const extractedClips = await extractImportantVoiceCallClips({
    imageTitle: getEmberTitle(voiceCall.contributor.image),
    contributorName: contributorLabel,
    transcript: voiceCall.transcript,
    segments: transcriptSegments,
  });
  const hasInterviewResponses = extracted.responses.length > 0;
  const hasInterviewSummary = extracted.summary.trim().length > 0;
  const shouldMarkCompleted =
    extracted.isComplete || hasInterviewResponses || hasInterviewSummary;

  if (hasInterviewResponses) {
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
      status: shouldMarkCompleted ? 'completed' : 'active',
      currentStep: shouldMarkCompleted ? 'completed' : conversation.currentStep,
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

  await prisma.voiceCallClip.deleteMany({
    where: { voiceCallId: voiceCall.id },
  });

  if (extractedClips.length > 0) {
    await prisma.voiceCallClip.createMany({
      data: extractedClips.map((clip) => ({
        imageId: voiceCall.contributor.imageId,
        contributorId: voiceCall.contributorId,
        voiceCallId: voiceCall.id,
        sortOrder: clip.sortOrder,
        title: clip.title,
        quote: clip.quote,
        significance: clip.significance,
        speaker: clip.speaker,
        audioUrl: voiceCall.recordingUrl,
        startMs: clip.startMs,
        endMs: clip.endMs,
        canUseForTitle: clip.canUseForTitle,
      })),
    });
  }

  if (hasInterviewResponses || hasInterviewSummary) {
    try {
      await generateWikiForImage(voiceCall.contributor.imageId);
    } catch (error) {
      console.error('Failed to auto-generate wiki after voice sync:', error);
    }
  }
}

function shouldSendMissedCallFollowUp(voiceCall: {
  status: string;
  callSuccessful: boolean | null;
  disconnectionReason: string | null;
  transcript: string | null;
}) {
  if (voiceCall.status !== 'ended') {
    return false;
  }

  const disconnectionReason = voiceCall.disconnectionReason?.toLowerCase() || '';
  return (
    isMissedCallTranscript(voiceCall.transcript) ||
    disconnectionReason.includes('voicemail') ||
    disconnectionReason.includes('no_answer') ||
    disconnectionReason.includes('no-answer') ||
    disconnectionReason.includes('not_answer') ||
    disconnectionReason.includes('not-answer') ||
    (voiceCall.callSuccessful === false && !voiceCall.transcript?.trim())
  );
}

async function sendMissedCallFollowUp(voiceCallId: string) {
  const alreadySent = await prisma.voiceCallEvent.findFirst({
    where: {
      voiceCallId,
      eventType: 'missed_call_followup_sent',
    },
    select: { id: true },
  });

  if (alreadySent) {
    return;
  }

  const voiceCall = await prisma.voiceCall.findUnique({
    where: { id: voiceCallId },
    include: {
      contributor: {
        include: {
          user: {
            select: {
              email: true,
              phoneNumber: true,
            },
          },
          image: {
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!voiceCall || !shouldSendMissedCallFollowUp(voiceCall)) {
    return;
  }

  const contributor = voiceCall.contributor;
  const image = contributor.image;
  const isCreator = contributor.userId === image.owner.id;

  if (isCreator) {
    return;
  }

  const contributorName = contributor.name?.trim() || getFirstName(contributor.user?.email, 'there');
  const ownerFirstName = getFirstName(image.owner.name, 'Someone');
  const targetUrl = `/contribute/${contributor.token}`;
  const inviteUrl = buildAbsoluteUrl(targetUrl);
  const shortLink = await getOrCreateShortLink(targetUrl);
  const thumbnailUrl = buildAbsoluteUrl(
    getPreviewUploadUrl({
      mediaType: image.mediaType,
      filename: image.filename,
      posterFilename: image.posterFilename,
    })
  );
  const smsRecipient = contributor.phoneNumber || contributor.user?.phoneNumber;
  const emailRecipient = contributor.email || contributor.user?.email;
  const smsBody = `Hi, this is ember. ${ownerFirstName} shared a photo and would love your take on that moment. Add it here ${shortLink.shortUrl}`;
  const previewText = "He’d love your take on that moment";
  const subject = `${ownerFirstName} shared an ember with you`;

  const sendResults = await Promise.allSettled([
    smsRecipient
      ? sendSMS(normalizePhoneForSms(smsRecipient), smsBody)
      : Promise.resolve('skipped'),
    emailRecipient && isEmailConfigured()
      ? sendEmail({
          to: emailRecipient,
          subject,
          text: [
            `Hi ${contributorName},`,
            '',
            `${ownerFirstName} shared an ember with you—a photo and memory—and tried to reach you. We missed you.`,
            "We’d love your take on that moment. It only takes a minute.",
            '',
            inviteUrl,
            '',
            'No app needed—just tap and share what you remember.',
            '',
            '—Ember',
          ].join('\n'),
          html: `
            <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(previewText)}</div>
            <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f7f5;padding:32px;">
              <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid rgba(17,17,17,0.08);border-radius:20px;padding:32px;color:#111111;">
                <p style="margin:0 0 20px;font-size:16px;line-height:1.6;">Hi ${escapeHtml(contributorName)},</p>
                <img src="${escapeHtml(thumbnailUrl)}" alt="Shared Ember photo" style="display:block;width:100%;max-height:360px;object-fit:cover;border-radius:14px;margin:0 0 24px;" />
                <p style="margin:0 0 14px;font-size:16px;line-height:1.7;">${escapeHtml(ownerFirstName)} shared an ember with you—a photo and memory—and tried to reach you. We missed you.</p>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">We’d love your take on that moment. It only takes a minute.</p>
                <p style="margin:0 0 24px;">
                  <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#ff6621;color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 22px;font-weight:700;">Add your memory</a>
                </p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#555555;"><a href="${escapeHtml(inviteUrl)}" style="color:#ff6621;">${escapeHtml(inviteUrl)}</a></p>
                <p style="margin:0;font-size:14px;line-height:1.7;color:#555555;">No app needed—just tap and share what you remember.</p>
                <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#555555;">—Ember</p>
              </div>
            </div>
          `,
        })
      : Promise.resolve('skipped'),
  ]);

  const failed = sendResults.filter((result) => result.status === 'rejected');
  if (failed.length > 0) {
    console.error('Failed to send missed call follow-up:', failed);
  }

  if (sendResults.some((result) => result.status === 'fulfilled' && result.value !== 'skipped')) {
    await prisma.voiceCallEvent.create({
      data: {
        voiceCallId,
        eventType: 'missed_call_followup_sent',
        payloadJson: JSON.stringify({
          smsSent: Boolean(smsRecipient),
          emailSent: Boolean(emailRecipient && isEmailConfigured()),
        }),
      },
    });
  }
}

export async function refreshVoiceCallFromProvider(voiceCallId: string) {
  const existing = await prisma.voiceCall.findUnique({
    where: { id: voiceCallId },
  });

  if (!existing) {
    return null;
  }

  const latestCallResponse = await retrieveRetellCall(existing.retellCallId);
  const call = asRetellCallResponse(latestCallResponse);
  if (!call) {
    throw new Error('Retell provider did not return a valid call');
  }

  const shouldTreatAsAnalyzed =
    Boolean(call.call_analysis) || Boolean(call.transcript?.trim());
  const eventType = shouldTreatAsAnalyzed
    ? 'call_analyzed'
    : call.call_status === 'ended'
      ? 'call_ended'
      : 'provider_refresh';

  const updated = await upsertVoiceCallRecord(call, eventType, {
    source: 'provider_refresh',
    call,
  });

  if (shouldTreatAsAnalyzed) {
    await syncVoiceCallToConversation(updated.id);
  }

  if (eventType === 'call_ended' || eventType === 'call_analyzed') {
    await sendMissedCallFollowUp(updated.id);
  }

  return prisma.voiceCall.findUnique({
    where: { id: updated.id },
  });
}

async function prepareVoiceCallContext(contributorId: string) {
  const contributor = await prisma.contributor.findUnique({
    where: { id: contributorId },
    include: {
      image: true,
      conversation: {
        select: {
          id: true,
        },
      },
      voiceCalls: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!contributor) {
    throw new Error('Contributor not found');
  }

  if (!contributor.phoneNumber) {
    throw new Error('Contributor does not have a phone number for voice calls');
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

  const priorMemoryContext = await buildPriorMemoryContext({
    contributorId: contributor.id,
    conversationId: conversation.id,
  });

  const dynamicVariables = pickDynamicVariables({
    contributor_name: contributor.name,
    image_title: getEmberTitle(contributor.image),
    image_description: contributor.image.description,
    prior_interview_count:
      priorMemoryContext.priorInterviewCount > 0
        ? String(priorMemoryContext.priorInterviewCount)
        : null,
    previous_memory_summary: priorMemoryContext.previousMemorySummary,
    follow_up_focus: priorMemoryContext.followUpFocus,
  });

  return {
    contributor,
    conversation,
    dynamicVariables,
  };
}

export async function startVoiceCallForContributor({
  contributorId,
  initiatedBy,
}: {
  contributorId: string;
  initiatedBy: 'owner' | 'contributor';
}) {
  const { contributor, conversation, dynamicVariables } =
    await prepareVoiceCallContext(contributorId);

  if (!contributor.phoneNumber) {
    throw new Error('Contributor does not have a phone number for voice calls');
  }

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

export async function startWebVoiceCallForContributor({
  contributorId,
  initiatedBy,
}: {
  contributorId: string;
  initiatedBy: 'owner' | 'contributor';
}) {
  const { contributor, conversation, dynamicVariables } =
    await prepareVoiceCallContext(contributorId);

  const call = await createRetellWebCall({
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
    accessToken: call.access_token,
  };
}

export async function processRetellWebhook(rawPayload: unknown) {
  const payload = rawPayload as RetellWebhookPayload;
  const eventType = getEventType(payload);
  const webhookCall = getCallFromPayload(payload);

  const latestCallResponse =
    eventType === 'call_ended' || eventType === 'call_analyzed'
      ? await retrieveRetellCall(webhookCall.call_id).catch(() => webhookCall)
      : webhookCall;

  const call = asRetellCallResponse(latestCallResponse);
  if (!call) {
    throw new Error('Retell webhook did not resolve to a valid call');
  }

  const voiceCall = await upsertVoiceCallRecord(call, eventType, rawPayload);

  if (eventType === 'call_analyzed') {
    await syncVoiceCallToConversation(voiceCall.id);
  }

  if (eventType === 'call_ended' || eventType === 'call_analyzed') {
    await sendMissedCallFollowUp(voiceCall.id);
  }

  return voiceCall;
}
