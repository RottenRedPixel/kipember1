import { prisma } from '@/lib/db';
import { sendSMS } from '@/lib/twilio';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { getEmberTitle } from '@/lib/ember-title';

/**
 * Retell disconnection reasons that unambiguously mean the call didn't
 * connect to a real human conversation. When any of these fire, notify
 * immediately — call_analyzed typically won't follow.
 */
const HARD_FAIL_REASONS = new Set([
  'dial_no_answer',
  'dial_busy',
  'dial_failed',
  'voicemail_reached',
  'machine_detected',
  'inactivity',
]);

/**
 * Reasons that might still be "completed successfully" depending on what
 * the post-call analysis says. For these we wait for call_analyzed before
 * deciding — except for very short user_hangups.
 */
const SHORT_HANGUP_THRESHOLD_MS = 30 * 1000;

type OutcomeClassification =
  | { outcome: 'failed'; reason: string }
  | { outcome: 'succeeded' }
  | { outcome: 'indeterminate' };

type VoiceCallSnapshot = {
  status: string;
  disconnectionReason: string | null;
  callSuccessful: boolean | null;
  transcript: string | null;
  durationMs: number | null;
  analyzedAt: Date | null;
};

export function classifyVoiceCallOutcome(
  call: VoiceCallSnapshot
): OutcomeClassification {
  // Haven't ended yet — can't decide.
  if (call.status !== 'ended') {
    return { outcome: 'indeterminate' };
  }

  const reason = call.disconnectionReason ?? '';

  if (HARD_FAIL_REASONS.has(reason)) {
    return { outcome: 'failed', reason };
  }

  // Explicit success from post-call analysis always wins.
  if (call.callSuccessful === true) {
    return { outcome: 'succeeded' };
  }

  if (reason === 'user_hangup') {
    if (call.analyzedAt && call.callSuccessful === false) {
      return { outcome: 'failed', reason };
    }
    if (
      typeof call.durationMs === 'number' &&
      call.durationMs < SHORT_HANGUP_THRESHOLD_MS
    ) {
      return { outcome: 'failed', reason };
    }
    // Long hangup, analysis may still be pending — wait.
    if (!call.analyzedAt) {
      return { outcome: 'indeterminate' };
    }
    // Analyzed and not marked successful → treat as failed (empty transcript).
    if (!call.transcript?.trim()) {
      return { outcome: 'failed', reason };
    }
    return { outcome: 'succeeded' };
  }

  // agent_hangup / call_transfer / anything else ending cleanly — if
  // analysis has run and marked it unsuccessful or transcript is empty,
  // treat as failed. Otherwise assume it completed.
  if (call.analyzedAt) {
    if (call.callSuccessful === false || !call.transcript?.trim()) {
      return {
        outcome: 'failed',
        reason: reason || 'empty_transcript',
      };
    }
    return { outcome: 'succeeded' };
  }

  return { outcome: 'indeterminate' };
}

function buildContributorSms(params: {
  contributorName: string | null;
  emberTitle: string;
  ownerName: string | null;
}): string {
  const who = params.ownerName?.trim() || 'someone';
  const name = params.contributorName?.trim();
  const greeting = name ? `Hi ${name}, ` : 'Hi, ';
  return (
    `${greeting}we tried to reach you for "${params.emberTitle}" but the call didn't go through. ` +
    `${who} would still love to hear your memory — we'll try again, or you can reply to this text when you're ready.`
  );
}

function buildOwnerSms(params: {
  contributorName: string | null;
  emberTitle: string;
  reason: string;
}): string {
  const name = params.contributorName?.trim() || 'your contributor';
  const reasonLabel = formatReasonForHumans(params.reason);
  return (
    `Kipember: the interview call to ${name} for "${params.emberTitle}" didn't complete ` +
    `(${reasonLabel}). They've been notified. You can retry from the memory view.`
  );
}

function buildOwnerEmail(params: {
  contributorName: string | null;
  contributorPhone: string | null;
  emberTitle: string;
  reason: string;
  voiceCallId: string;
}): { subject: string; text: string; html: string } {
  const name = params.contributorName?.trim() || 'Your contributor';
  const phone = params.contributorPhone?.trim() || 'unknown number';
  const reasonLabel = formatReasonForHumans(params.reason);
  const subject = `Interview call didn't complete — ${params.emberTitle}`;

  const text = [
    `The interview call for "${params.emberTitle}" didn't complete.`,
    '',
    `Contributor: ${name} (${phone})`,
    `Reason: ${reasonLabel}`,
    '',
    `We've sent ${name} a text letting them know. You can retry the call from the memory view.`,
    '',
    `Reference: ${params.voiceCallId}`,
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Interview call didn't complete</h2>
      <p>The interview call for <strong>${escapeHtml(params.emberTitle)}</strong> didn't complete.</p>
      <ul style="line-height: 1.6;">
        <li><strong>Contributor:</strong> ${escapeHtml(name)} (${escapeHtml(phone)})</li>
        <li><strong>Reason:</strong> ${escapeHtml(reasonLabel)}</li>
      </ul>
      <p>We've sent ${escapeHtml(name)} a text letting them know. You can retry the call from the memory view.</p>
      <p style="color: #888; font-size: 12px; margin-top: 32px;">Reference: ${escapeHtml(params.voiceCallId)}</p>
    </div>
  `;

  return { subject, text, html };
}

function formatReasonForHumans(reason: string): string {
  switch (reason) {
    case 'dial_no_answer':
      return 'no answer';
    case 'dial_busy':
      return 'line busy';
    case 'dial_failed':
      return 'unable to dial the number';
    case 'voicemail_reached':
    case 'machine_detected':
      return 'went to voicemail';
    case 'inactivity':
      return 'no response after connecting';
    case 'user_hangup':
      return 'the call ended early';
    case 'empty_transcript':
      return 'the call ended without a usable conversation';
    default:
      return reason.replace(/_/g, ' ') || 'the call did not complete';
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

/**
 * Inspects the voice call and, if it represents a failed/unanswered call
 * that hasn't been notified yet, sends SMS to the contributor, SMS to the
 * image owner (if they have a phone number), and email to the image owner.
 *
 * Idempotent: checks and sets `failureNotifiedAt` under a transactional
 * update so concurrent webhooks won't double-send.
 */
export async function maybeNotifyFailedCall(voiceCallId: string): Promise<void> {
  const voiceCall = await prisma.voiceCall.findUnique({
    where: { id: voiceCallId },
    include: {
      contributor: {
        include: {
          image: {
            include: {
              owner: true,
            },
          },
        },
      },
    },
  });

  if (!voiceCall) {
    return;
  }

  if (voiceCall.failureNotifiedAt) {
    return;
  }

  const classification = classifyVoiceCallOutcome({
    status: voiceCall.status,
    disconnectionReason: voiceCall.disconnectionReason,
    callSuccessful: voiceCall.callSuccessful,
    transcript: voiceCall.transcript,
    durationMs: voiceCall.durationMs,
    analyzedAt: voiceCall.analyzedAt,
  });

  if (classification.outcome !== 'failed') {
    return;
  }

  // Claim the notification slot atomically so concurrent webhooks can't
  // race us. Only one writer will succeed in changing NULL → now().
  const claimed = await prisma.voiceCall.updateMany({
    where: { id: voiceCall.id, failureNotifiedAt: null },
    data: { failureNotifiedAt: new Date() },
  });

  if (claimed.count === 0) {
    // Someone else already notified.
    return;
  }

  const { contributor } = voiceCall;
  const owner = contributor.image.owner;
  const emberTitle = getEmberTitle(contributor.image);

  const contributorSms = buildContributorSms({
    contributorName: contributor.name,
    emberTitle,
    ownerName: owner.name,
  });
  const ownerSms = buildOwnerSms({
    contributorName: contributor.name,
    emberTitle,
    reason: classification.reason,
  });
  const ownerEmail = buildOwnerEmail({
    contributorName: contributor.name,
    contributorPhone: contributor.phoneNumber,
    emberTitle,
    reason: classification.reason,
    voiceCallId: voiceCall.id,
  });

  // Send channels in parallel but independently — one failure shouldn't
  // prevent the others. Errors are logged but not thrown, since the webhook
  // must still return 200 to Retell.
  await Promise.all([
    sendChannel(
      'contributor-sms',
      voiceCall.id,
      contributor.phoneNumber,
      (to) => sendSMS(to, contributorSms)
    ),
    sendChannel('owner-sms', voiceCall.id, owner.phoneNumber, (to) =>
      sendSMS(to, ownerSms)
    ),
    sendChannel('owner-email', voiceCall.id, owner.email, (to) => {
      if (!isEmailConfigured()) {
        console.warn(
          `[voice-call-notifications] SMTP not configured; skipping owner email for ${voiceCall.id}`
        );
        return Promise.resolve();
      }
      return sendEmail({
        to,
        subject: ownerEmail.subject,
        text: ownerEmail.text,
        html: ownerEmail.html,
      });
    }),
  ]);
}

async function sendChannel(
  channel: string,
  voiceCallId: string,
  destination: string | null | undefined,
  send: (to: string) => Promise<unknown>
): Promise<void> {
  if (!destination?.trim()) {
    // Per spec: missing owner phone = silently skip. Same for a contributor
    // with no phone (shouldn't happen — phone calls can't be placed without
    // one — but safe to guard).
    if (channel === 'contributor-sms' || channel === 'owner-email') {
      console.warn(
        `[voice-call-notifications] skipping ${channel} for ${voiceCallId}: no destination`
      );
    }
    return;
  }

  try {
    await send(destination.trim());
  } catch (error) {
    console.error(
      `[voice-call-notifications] ${channel} failed for ${voiceCallId}:`,
      error
    );
  }
}
