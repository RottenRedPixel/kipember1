import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { getEmberAccessType } from '@/lib/ember';
import { prisma } from '@/lib/db';
import { contributorChatSessionIdentity, ensureEmberSession } from '@/lib/ember-sessions';
import { persistUploadedMedia } from '@/lib/media-upload';
import { ensureUserContributorForImage } from '@/lib/owner-contributor';
import {
  getAudioTranscriptionModel,
  getConfiguredOpenAIModel,
  getOpenAIClient,
} from '@/lib/openai';
import { reconcileEmberMessageSafely } from '@/lib/memory-reconciliation';

function buildAttachmentDescription(transcript: string | null) {
  const prefix = 'Ask Ember voice note';
  const cleaned = transcript?.replace(/\s+/g, ' ').trim() || '';

  if (!cleaned) {
    return prefix;
  }

  const summary = cleaned.length > 260 ? `${cleaned.slice(0, 257).trimEnd()}...` : cleaned;
  return `${prefix}: ${summary}`;
}

function trimStoredTranscript(value: string | null | undefined) {
  const cleaned = value?.replace(/\s+/g, ' ').trim() || '';
  if (!cleaned) {
    return null;
  }

  return cleaned.length > 360 ? `${cleaned.slice(0, 357).trimEnd()}...` : cleaned;
}

async function transcribeUploadedAudio(file: File) {
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
    console.error('Ask audio transcription error:', error);
    return null;
  }
}

async function ensureContributorSession(contributorId: string, imageId: string) {
  const contributor = await prisma.contributor.findUnique({
    where: { id: contributorId },
    include: {
      image: {
        select: {
          ownerId: true,
        },
      },
    },
  });

  if (!contributor) {
    throw new Error('Contributor not found');
  }
  if (contributor.imageId !== imageId) {
    throw new Error('Contributor does not belong to this image');
  }

  const identity = contributorChatSessionIdentity(contributor);

  return ensureEmberSession({
    ...identity,
    contributorId,
    userId: identity.participantType === 'owner' ? contributor.userId : null,
    status: 'active',
    currentStep: 'followup',
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const imageId = typeof formData.get('imageId') === 'string' ? String(formData.get('imageId')) : '';
    const transcript =
      typeof formData.get('transcript') === 'string' ? String(formData.get('transcript')).trim() : '';
    const file = formData.get('file');

    if (!imageId || !(file instanceof File)) {
      return NextResponse.json({ error: 'imageId and file are required' }, { status: 400 });
    }

    const accessType = await getEmberAccessType(auth.user.id, imageId);
    if (!accessType) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    let persistedMedia;
    try {
      persistedMedia = await persistUploadedMedia(file);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Only images, videos, and common audio files are supported',
        },
        { status: 400 }
      );
    }

    const resolvedTranscript = transcript || (persistedMedia.mediaType === 'AUDIO'
      ? await transcribeUploadedAudio(file)
      : null) || '';

    const attachment = await prisma.imageAttachment.create({
      data: {
        imageId,
        filename: persistedMedia.filename,
        mediaType: persistedMedia.mediaType,
        posterFilename: persistedMedia.posterFilename,
        durationSeconds: persistedMedia.durationSeconds,
        originalName: file.name,
        description: buildAttachmentDescription(resolvedTranscript || null),
      },
      select: {
        id: true,
        filename: true,
        mediaType: true,
        posterFilename: true,
        durationSeconds: true,
        originalName: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const storedTranscript = trimStoredTranscript(resolvedTranscript || null);
    if (storedTranscript) {
      try {
        const contributor = await ensureUserContributorForImage(imageId, auth.user.id);
        if (contributor) {
          const session = await ensureContributorSession(contributor.id, imageId);

          if (session) {
            const memoryMessage = await prisma.emberMessage.create({
              data: {
                sessionId: session.id,
                role: 'user',
                content: storedTranscript,
                source: 'voice',
                questionType: 'followup',
                question: 'followup',
              },
            });
            await reconcileEmberMessageSafely(
              memoryMessage.id,
              'Ask voice note memory reconciliation'
            );
          }
        }
      } catch (sessionError) {
        console.error('Ask audio session persistence error:', sessionError);
      }
    }

    return NextResponse.json({
      attachment,
      transcript: storedTranscript,
      warning: persistedMedia.warning,
    });
  } catch (error) {
    console.error('Ask audio upload error:', error);
    return NextResponse.json({ error: 'Failed to save Ask voice note' }, { status: 500 });
  }
}
