// Token-authed voice surface mirroring /api/voice for logged-in users.
// The guest hits POST with an audio blob, we transcribe it, persist the
// recording + transcript as a user message, generate Ember's voice reply,
// TTS it, persist the assistant message, and return both audio URLs so the
// client can render the message pair and auto-play the reply.
//
// Session participant identity follows the same rule as
// /api/contribute/[token]/route.ts:
//   - Anonymous share-link guests (no name/phone/email/userId on the
//     contributor row) get participantType 'guest' keyed by a per-browser
//     cookie, so two browsers sharing the same link don't see each other's
//     voice notes.
//   - Named contributors keep participantType 'contributor' keyed by the
//     EmberContributor.id, matching the chat session.
//
// We deliberately do NOT use requireApiUser here — the whole point is to
// let unauthenticated visitors talk to Ember through the share link.

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import {
  PROMPT_REMOVED_MESSAGE,
  isFeatureEnabled,
  isPromptRemovedError,
} from '@/lib/control-plane';
import {
  emberSessionParticipantWhere,
  ensureEmberSession,
  type EmberParticipantType,
} from '@/lib/ember-sessions';
import { generateEmberVoiceReply } from '@/lib/ember-voice-reply';
import { reconcileEmberMessageSafely } from '@/lib/memory-reconciliation';
import {
  getAudioTranscriptionModel,
  getConfiguredOpenAIModel,
  getOpenAIClient,
} from '@/lib/openai';
import { persistUploadedMedia } from '@/lib/media-upload';
import { synthesizeSpeech } from '@/lib/tts';

// Same cookie name the chat route uses, so chat + voice share the same
// per-browser identity for share-link guests.
const GUEST_BROWSER_COOKIE = 'kb-guest-browser';
const GUEST_BROWSER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const HISTORY_LIMIT = 30;

type ResolvedToken = {
  imageId: string;
  emberContributorId: string;
  isGuestShareLink: boolean;
  imageIsPrivate: boolean;
};

async function resolveToken(token: string): Promise<ResolvedToken | null> {
  const emberContributor = await prisma.emberContributor.findUnique({
    where: { token },
    include: {
      contributor: true,
      image: { select: { id: true, keepPrivate: true } },
    },
  });

  if (!emberContributor) return null;

  const c = emberContributor.contributor;
  const isGuestShareLink = !c.name && !c.phoneNumber && !c.email && !c.userId;

  return {
    imageId: emberContributor.image.id,
    emberContributorId: emberContributor.id,
    isGuestShareLink,
    imageIsPrivate: emberContributor.image.keepPrivate ?? false,
  };
}

function participantFor(resolved: ResolvedToken, guestBrowserId: string | null) {
  const participantType: EmberParticipantType = resolved.isGuestShareLink ? 'guest' : 'contributor';
  const participantId = resolved.isGuestShareLink
    ? (guestBrowserId ?? '')
    : resolved.emberContributorId;
  return { participantType, participantId };
}

async function transcribeUploadedAudio(file: File): Promise<string | null> {
  try {
    const client = getOpenAIClient();
    const transcription = await client.audio.transcriptions.create({
      file,
      model: await getConfiguredOpenAIModel(
        'audio.transcription',
        getAudioTranscriptionModel()
      ),
    });
    const text = transcription.text?.replace(/\s+/g, ' ').trim() || '';
    return text || null;
  } catch (error) {
    console.error('Guest voice transcription error:', error);
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const resolved = await resolveToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Guest memory not found' }, { status: 404 });
    }
    if (resolved.imageIsPrivate) {
      return NextResponse.json({ error: 'This ember is private.' }, { status: 403 });
    }

    if (!(await isFeatureEnabled('ask_ember', true))) {
      return NextResponse.json({ error: 'Voice mode is currently disabled' }, { status: 503 });
    }

    const formData = await request.formData();
    const audio = formData.get('audio');
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'audio is required' }, { status: 400 });
    }

    // Mint a per-browser cookie for share-link guests so each browser has
    // its own voice session. Named contributors don't need it.
    const existingBrowserId = request.cookies.get(GUEST_BROWSER_COOKIE)?.value;
    const guestBrowserId = resolved.isGuestShareLink
      ? existingBrowserId || randomUUID()
      : null;

    const participant = participantFor(resolved, guestBrowserId);
    if (!participant.participantId) {
      return NextResponse.json({ error: 'Could not resolve participant' }, { status: 500 });
    }

    const session = await ensureEmberSession({
      imageId: resolved.imageId,
      sessionType: 'voice',
      participantType: participant.participantType,
      participantId: participant.participantId,
      emberContributorId: resolved.isGuestShareLink ? null : resolved.emberContributorId,
      browserId: guestBrowserId,
      status: 'active',
    });

    let persistedAudio;
    try {
      persistedAudio = await persistUploadedMedia(audio);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Could not save the recording. Please try again.',
        },
        { status: 400 }
      );
    }

    const transcript = (await transcribeUploadedAudio(audio)) || '';

    const userMessage = await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: transcript,
        source: 'voice',
        audioFilename: persistedAudio.filename,
      },
    });

    // Reuse the same role mapping the chat route uses for the prompt: anon
    // share-link visitors get 'guest' style, named contributors get
    // 'contributor' style. Owners never reach this route (they're logged
    // in and use /api/voice).
    const replyRole = resolved.isGuestShareLink ? 'guest' : 'contributor';

    const [replyText] = await Promise.all([
      generateEmberVoiceReply({
        imageId: resolved.imageId,
        role: replyRole,
        trigger: 'mic_message',
        transcript,
      }),
      reconcileEmberMessageSafely(userMessage.id, 'guest voice housekeeping'),
    ]);

    let replyAudioFilename: string | null = null;
    try {
      const synthesized = await synthesizeSpeech({ text: replyText });
      replyAudioFilename = synthesized.filename;
    } catch (synthError) {
      console.error('Guest voice reply TTS failed:', synthError);
    }

    await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: replyText,
        source: 'voice',
        audioFilename: replyAudioFilename,
      },
    });

    const nextResponse = NextResponse.json({
      transcript,
      reply: replyText,
      replyAudioUrl: replyAudioFilename ? `/api/uploads/${replyAudioFilename}` : null,
      userAudioUrl: `/api/uploads/${persistedAudio.filename}`,
    });

    if (guestBrowserId && !existingBrowserId) {
      nextResponse.cookies.set(GUEST_BROWSER_COOKIE, guestBrowserId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: GUEST_BROWSER_COOKIE_MAX_AGE,
        path: '/',
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('Guest voice mode error:', error);
    if (isPromptRemovedError(error)) {
      return NextResponse.json({ error: PROMPT_REMOVED_MESSAGE }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to process voice turn' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const resolved = await resolveToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Guest memory not found' }, { status: 404 });
    }
    if (resolved.imageIsPrivate) {
      return NextResponse.json({ error: 'This ember is private.' }, { status: 403 });
    }

    if (!(await isFeatureEnabled('ask_ember', true))) {
      return NextResponse.json({ error: 'Voice mode is currently disabled' }, { status: 503 });
    }

    // For history, we never mint a new cookie — if the browser doesn't
    // have one yet there's no session to read from, so just return empty.
    const existingBrowserId = request.cookies.get(GUEST_BROWSER_COOKIE)?.value;
    if (resolved.isGuestShareLink && !existingBrowserId) {
      return NextResponse.json({ messages: [] });
    }

    const participant = participantFor(resolved, existingBrowserId ?? null);
    if (!participant.participantId) {
      return NextResponse.json({ messages: [] });
    }

    const session = await prisma.emberSession.findUnique({
      where: emberSessionParticipantWhere({
        imageId: resolved.imageId,
        sessionType: 'voice',
        participantType: participant.participantType,
        participantId: participant.participantId,
      }),
    });

    const history = session
      ? await prisma.emberMessage.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: 'asc' },
          take: HISTORY_LIMIT,
        })
      : [];

    const messages = history.map((entry) => ({
      role: entry.role,
      content: entry.content,
      source: 'voice' as const,
      audioUrl: entry.audioFilename ? `/api/uploads/${entry.audioFilename}` : null,
      createdAt: entry.createdAt.toISOString(),
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Guest voice history error:', error);
    return NextResponse.json({ error: 'Failed to load voice history' }, { status: 500 });
  }
}
