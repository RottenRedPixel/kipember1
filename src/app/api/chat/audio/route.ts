import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { getImageAccessType } from '@/lib/ember-access';
import { prisma } from '@/lib/db';
import { persistUploadedMedia } from '@/lib/media-upload';
import { ensureUserContributorForImage } from '@/lib/owner-contributor';
import { getAudioTranscriptionModel, getOpenAIClient } from '@/lib/openai';

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
      model: getAudioTranscriptionModel(),
    });

    const text = transcription.text?.replace(/\s+/g, ' ').trim() || '';
    return text || null;
  } catch (error) {
    console.error('Ask audio transcription error:', error);
    return null;
  }
}

async function ensureContributorConversation(contributorId: string) {
  return prisma.conversation.upsert({
    where: {
      contributorId,
    },
    update: {},
    create: {
      contributorId,
      status: 'active',
      currentStep: 'followup',
    },
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

    const accessType = await getImageAccessType(auth.user.id, imageId);
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
          const conversation = await ensureContributorConversation(contributor.id);

          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              role: 'user',
              content: storedTranscript,
              source: 'voice',
            },
          });

          await prisma.response.create({
            data: {
              conversationId: conversation.id,
              questionType: 'followup',
              question: 'What else would you like Ember to remember about this moment?',
              answer: storedTranscript,
              source: 'voice',
            },
          });
        }
      } catch (conversationError) {
        console.error('Ask audio conversation persistence error:', conversationError);
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
