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
import { persistEmberVoiceClips, syncVoiceClipsFromClaims } from '@/lib/ember-clips';
import { synthesizeSpeech } from '@/lib/tts';
import { getUserDisplayName } from '@/lib/user-name';

const HISTORY_LIMIT = 30;

type ResolvedToken = {
  emberId: string;
  emberContributorId: string;
  imageIsPrivate: boolean;
  emberTitle: string;
  speakerName: string;
};

async function resolveToken(token: string): Promise<ResolvedToken | null> {
  const emberContributor = await prisma.emberContributor.findUnique({
    where: { token },
    include: {
      ember: { select: { id: true, keepPrivate: true, title: true, originalName: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
    },
  });

  if (!emberContributor) return null;

  const emberTitle =
    emberContributor.ember.title ||
    (emberContributor.ember.originalName ?? 'Ember').replace(/\.[^.]+$/, '');

  const speakerName =
    getUserDisplayName(emberContributor.user) ||
    emberContributor.user?.email ||
    emberContributor.user?.phoneNumber ||
    'Contributor';

  return {
    emberId: emberContributor.ember.id,
    emberContributorId: emberContributor.id,
    imageIsPrivate: emberContributor.ember.keepPrivate ?? false,
    emberTitle,
    speakerName,
  };
}

async function transcribeUploadedAudio(file: File): Promise<{ text: string; transcriptObjectJson: string | null }> {
  try {
    const client = getOpenAIClient();
    const model = await getConfiguredOpenAIModel(
      'audio.transcription',
      getAudioTranscriptionModel()
    );

    // verbose_json + timestamp_granularities=['word'] is only supported by whisper-1.
    // Newer models (gpt-4o-transcribe, gpt-4o-mini-transcribe, etc.) reject these params.
    if (model === 'whisper-1') {
      const raw = await client.audio.transcriptions.create({
        file,
        model,
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
      } as Parameters<typeof client.audio.transcriptions.create>[0]) as unknown as {
        text: string;
        words?: Array<{ word: string; start: number; end: number }>;
      };
      const text = (raw.text ?? '').replace(/\s+/g, ' ').trim();
      const transcriptObjectJson = Array.isArray(raw.words) && raw.words.length > 0
        ? JSON.stringify(raw.words.map((w) => ({
            word: w.word,
            startMs: Math.round(w.start * 1000),
            endMs: Math.round(w.end * 1000),
          })))
        : null;
      return { text: text || '', transcriptObjectJson };
    }

    // For gpt-4o-transcribe, gpt-4o-mini-transcribe, and any future models: plain transcription.
    const result = await client.audio.transcriptions.create({ file, model });
    const text = (result.text ?? '').replace(/\s+/g, ' ').trim();
    return { text: text || '', transcriptObjectJson: null };
  } catch (error) {
    console.error('Contributor voice transcription error:', error);
    return { text: '', transcriptObjectJson: null };
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

    const { text: transcript, transcriptObjectJson } = await transcribeUploadedAudio(audio);

    const userMessage = await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: transcript,
        source: 'voice',
        audioFilename: persistedAudio.filename,
        transcriptObjectJson,
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

    // Fire-and-forget: LLM clip extraction followed by claim-backed sync.
    // reconcileEmberMessageSafely already ran above, so claims are available
    // for syncVoiceClipsFromClaims to fill any gaps the LLM missed.
    if (transcript) {
      persistEmberVoiceClips({
        emberId: resolved.emberId,
        emberContributorId: resolved.emberContributorId,
        emberMessageId: userMessage.id,
        emberTitle: resolved.emberTitle,
        speakerName: resolved.speakerName,
        transcript,
        audioFilename: persistedAudio.filename,
        transcriptObjectJson,
      })
        .then(() =>
          syncVoiceClipsFromClaims({
            emberId: resolved.emberId,
            emberContributorId: resolved.emberContributorId,
            emberMessageId: userMessage.id,
            speakerName: resolved.speakerName,
            audioFilename: persistedAudio.filename,
            transcriptObjectJson,
          })
        )
        .catch((err) => {
          console.error('Contributor EmberVoice clip extraction error:', err);
        });
    }

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
