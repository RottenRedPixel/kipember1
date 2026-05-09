// Token-authed voice surface for contributors (named people with share links).
// The contributor hits POST with an audio blob, we transcribe it, persist the
// recording + transcript as a user message, generate Ember's voice reply,
// TTS it, persist the assistant message, and return both audio URLs so the
// client can render the message pair and auto-play the reply.
//
// We deliberately do NOT use requireApiUser here — contributors access via
// their personal share token, not a logged-in session.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  PROMPT_REMOVED_MESSAGE,
  isFeatureEnabled,
  isPromptRemovedError,
} from '@/lib/control-plane';
import {
  emberSessionParticipantWhere,
  ensureEmberSession,
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

const HISTORY_LIMIT = 30;

type ResolvedToken = {
  emberId: string;
  emberContributorId: string;
  imageIsPrivate: boolean;
};

async function resolveToken(token: string): Promise<ResolvedToken | null> {
  const emberContributor = await prisma.emberContributor.findUnique({
    where: { token },
    include: {
      ember: { select: { id: true, keepPrivate: true } },
    },
  });

  if (!emberContributor) return null;

  return {
    emberId: emberContributor.ember.id,
    emberContributorId: emberContributor.id,
    imageIsPrivate: emberContributor.ember.keepPrivate ?? false,
  };
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
    console.error('Contributor voice transcription error:', error);
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
      return NextResponse.json({ error: 'Contributor not found' }, { status: 404 });
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

    const session = await ensureEmberSession({
      emberId: resolved.emberId,
      sessionType: 'voice',
      participantType: 'contributor',
      participantId: resolved.emberContributorId,
      emberContributorId: resolved.emberContributorId,
      browserId: null,
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

    const [replyText] = await Promise.all([
      generateEmberVoiceReply({
        emberId: resolved.emberId,
        role: 'contributor',
        trigger: 'mic_message',
        transcript,
        sessionId: session.id,
      }),
      reconcileEmberMessageSafely(userMessage.id, 'contributor voice housekeeping'),
    ]);

    let replyAudioFilename: string | null = null;
    try {
      const synthesized = await synthesizeSpeech({ text: replyText });
      replyAudioFilename = synthesized.filename;
    } catch (synthError) {
      console.error('Contributor voice reply TTS failed:', synthError);
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

    return NextResponse.json({
      transcript,
      reply: replyText,
      replyAudioUrl: replyAudioFilename ? `/api/uploads/${replyAudioFilename}` : null,
      userAudioUrl: `/api/uploads/${persistedAudio.filename}`,
    });
  } catch (error) {
    console.error('Contributor voice mode error:', error);
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
    void request;
    const { token } = await params;
    const resolved = await resolveToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Contributor not found' }, { status: 404 });
    }
    if (resolved.imageIsPrivate) {
      return NextResponse.json({ error: 'This ember is private.' }, { status: 403 });
    }

    if (!(await isFeatureEnabled('ask_ember', true))) {
      return NextResponse.json({ error: 'Voice mode is currently disabled' }, { status: 503 });
    }

    const session = await prisma.emberSession.findUnique({
      where: emberSessionParticipantWhere({
        emberId: resolved.emberId,
        sessionType: 'voice',
        participantType: 'contributor',
        participantId: resolved.emberContributorId,
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
    console.error('Contributor voice history error:', error);
    return NextResponse.json({ error: 'Failed to load voice history' }, { status: 500 });
  }
}
