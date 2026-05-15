import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { PROMPT_REMOVED_MESSAGE, isFeatureEnabled, isPromptRemovedError } from '@/lib/control-plane';
import { prisma } from '@/lib/db';
import {
  emberSessionParticipantWhere,
  ensureEmberSession,
  type EmberParticipantType,
} from '@/lib/ember-sessions';
import { getEmberAccessType } from '@/lib/ember';
import { generateEmberVoiceReply } from '@/lib/ember-voice-reply';
import { extractAllClaimsFromContent } from '@/lib/memory-reconciliation';
import { getUserDisplayName } from '@/lib/user-name';
import { generateWikiForImage } from '@/lib/wiki-generator';
import {
  getAudioTranscriptionModel,
  getConfiguredOpenAIModel,
  getOpenAIClient,
} from '@/lib/openai';
import { persistUploadedMedia } from '@/lib/media-upload';
import { persistEmberVoiceClips } from '@/lib/ember-clips';
import { synthesizeSpeech } from '@/lib/tts';
import { getVoiceEntry } from '@/lib/voice-catalog';

const COOKIE_NAME = 'mw_voice_chat_v1';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const HISTORY_LIMIT = 30;

async function resolveUserVoiceParticipant({
  emberId,
  userId,
}: {
  emberId: string;
  userId: string;
}) {
  const ember = await prisma.ember.findUnique({
    where: { id: emberId },
    select: {
      ownerId: true,
      emberContributors: {
        where: { userId },
        select: { id: true },
        take: 1,
      },
    },
  });

  const participantType: EmberParticipantType =
    ember?.ownerId === userId
      ? 'owner'
      : ember?.emberContributors.length
        ? 'contributor'
        : 'guest';

  return {
    emberId,
    sessionType: 'voice' as const,
    participantType,
    participantId: userId,
  };
}

async function ensureVoiceSession({
  browserId,
  emberId,
  userId,
}: {
  browserId: string;
  emberId: string;
  userId: string;
}) {
  const participant = await resolveUserVoiceParticipant({ emberId, userId });
  return ensureEmberSession({
    ...participant,
    browserId,
    userId,
    status: 'active',
  });
}

async function transcribeUploadedAudio(file: File): Promise<{ text: string; transcriptObjectJson: string | null }> {
  try {
    const client = getOpenAIClient();
    const transcription = await client.audio.transcriptions.create({
      file,
      model: await getConfiguredOpenAIModel(
        'audio.transcription',
        getAudioTranscriptionModel()
      ),
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    } as Parameters<typeof client.audio.transcriptions.create>[0]);
    const text = (transcription.text ?? '').replace(/\s+/g, ' ').trim();
    // Normalise Whisper words (seconds) → ms to match VoiceCall.transcriptObjectJson shape
    const raw = transcription as unknown as { words?: Array<{ word: string; start: number; end: number }> };
    const transcriptObjectJson = Array.isArray(raw.words) && raw.words.length > 0
      ? JSON.stringify(raw.words.map((w) => ({
          word: w.word,
          startMs: Math.round(w.start * 1000),
          endMs: Math.round(w.end * 1000),
        })))
      : null;
    return { text: text || '', transcriptObjectJson };
  } catch (error) {
    console.error('Voice mode transcription error:', error);
    return { text: '', transcriptObjectJson: null };
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!(await isFeatureEnabled('ask_ember', true))) {
      return NextResponse.json({ error: 'Voice mode is currently disabled' }, { status: 503 });
    }

    const formData = await request.formData();
    const emberId =
      typeof formData.get('emberId') === 'string' ? String(formData.get('emberId')) : '';
    const audio = formData.get('audio');

    if (!emberId || !(audio instanceof File)) {
      return NextResponse.json(
        { error: 'emberId and audio are required' },
        { status: 400 }
      );
    }

    const accessType = await getEmberAccessType(auth.user.id, emberId);
    if (!accessType) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const existingBrowserId = request.cookies.get(COOKIE_NAME)?.value;
    const browserId = existingBrowserId || randomUUID();
    const userId = auth.user.id;

    const participant = await resolveUserVoiceParticipant({ emberId, userId });
    const session = await ensureVoiceSession({ browserId, emberId, userId });

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

    const replyText = await generateEmberVoiceReply({
      emberId,
      role: participant.participantType,
      trigger: 'mic_message',
      transcript,
      sessionId: session.id,
    });

    if (transcript) {
      extractAllClaimsFromContent(
        {
          emberId,
          sessionId: session.id,
          emberContributorId: session.emberContributorId ?? null,
          userId,
          emberMessageId: userMessage.id,
          source: 'voice',
          questionType: null,
          question: null,
          content: transcript,
          sourceLabel: getUserDisplayName(auth.user) || auth.user.email || userId,
        },
        'voice housekeeping'
      ).then(() => generateWikiForImage(emberId)).catch((err) => {
        console.error('Voice housekeeping extraction error:', err);
      });

      // Fire-and-forget: extract memorable voice clips from this message
      const speakerName = getUserDisplayName(auth.user) || auth.user.email || 'Contributor';
      prisma.ember.findUnique({ where: { id: emberId }, select: { title: true, originalName: true } })
        .then((ember) => {
          const emberTitle = ember?.title || (ember?.originalName ?? 'Ember').replace(/\.[^.]+$/, '');
          return persistEmberVoiceClips({
            emberId,
            emberContributorId: session.emberContributorId ?? null,
            emberMessageId: userMessage.id,
            emberTitle,
            speakerName,
            transcript,
            audioFilename: persistedAudio.filename,
            transcriptObjectJson,
          });
        })
        .catch((err) => {
          console.error('EmberVoice clip extraction error:', err);
        });
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { voicePreferenceId: true },
    });
    const voiceEntry = getVoiceEntry(userRecord?.voicePreferenceId);

    let replyAudioFilename: string | null = null;
    try {
      const synthesized = await synthesizeSpeech({ text: replyText, voiceId: voiceEntry.elevenLabsId });
      replyAudioFilename = synthesized.filename;
    } catch (synthError) {
      console.error('Voice reply TTS failed:', synthError);
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

    if (!existingBrowserId || session.browserId !== browserId) {
      nextResponse.cookies.set(COOKIE_NAME, session.browserId ?? browserId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('Voice mode error:', error);
    if (isPromptRemovedError(error)) {
      return NextResponse.json({ error: PROMPT_REMOVED_MESSAGE }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to process voice turn' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!(await isFeatureEnabled('ask_ember', true))) {
      return NextResponse.json({ error: 'Voice mode is currently disabled' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const emberId = searchParams.get('emberId');
    if (!emberId) return NextResponse.json({ error: 'emberId is required' }, { status: 400 });

    const accessType = await getEmberAccessType(auth.user.id, emberId);
    if (!accessType) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const userId = auth.user.id;
    const participant = await resolveUserVoiceParticipant({ emberId, userId });

    const session = await prisma.emberSession.findUnique({
      where: emberSessionParticipantWhere(participant),
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
    console.error('Voice history error:', error);
    return NextResponse.json({ error: 'Failed to load voice history' }, { status: 500 });
  }
}
