import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { persistUploadedMedia } from '@/lib/media-upload';
import {
  emberSessionParticipantWhere,
  ensureEmberSession,
} from '@/lib/ember-sessions';
import { generateEmberChatReply } from '@/lib/ember-chat-reply';
import { analyzeAttachmentImage } from '@/lib/image-analysis';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { PROMPT_REMOVED_MESSAGE, isPromptRemovedError } from '@/lib/control-plane';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const emberContributor = await prisma.emberContributor.findUnique({
      where: { token },
      select: {
        id: true,
        emberId: true,
        userId: true,
      },
    });

    if (!emberContributor) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
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

    const attachment = await prisma.emberAttachment.create({
      data: {
        emberId: emberContributor.emberId,
        filename: persistedMedia.filename,
        mediaType: persistedMedia.mediaType,
        posterFilename: persistedMedia.posterFilename,
        durationSeconds: persistedMedia.durationSeconds,
        originalName: file.name,
      },
      select: {
        id: true,
        filename: true,
        mediaType: true,
        posterFilename: true,
        originalName: true,
        createdAt: true,
      },
    });

    // Background: visual analysis + wiki refresh
    if (persistedMedia.mediaType === 'IMAGE' || persistedMedia.mediaType === 'VIDEO') {
      const analyzeFilename =
        persistedMedia.mediaType === 'VIDEO' && persistedMedia.posterFilename
          ? persistedMedia.posterFilename
          : persistedMedia.filename;
      const attachmentId = attachment.id;
      const emberId = emberContributor.emberId;

      void (async () => {
        const analysisText = await analyzeAttachmentImage(analyzeFilename, file.name);
        if (analysisText) {
          await prisma.emberAttachment.update({
            where: { id: attachmentId },
            data: { analysisText },
          });
          await generateWikiForImage(emberId).catch((err) => {
            console.error('Wiki regen after contributor attachment analysis failed:', err);
          });
        }
      })();
    }

    // Ensure contributor chat session
    const sessionIdentity = {
      emberId: emberContributor.emberId,
      sessionType: 'chat' as const,
      participantType: 'contributor' as const,
      participantId: emberContributor.id,
    };

    const session = await ensureEmberSession({
      ...sessionIdentity,
      emberContributorId: emberContributor.id,
      browserId: null,
      status: 'active',
    });

    // Store user message with image
    await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: '',
        imageFilename: persistedMedia.filename,
        source: 'web',
      },
    });

    // Generate AI reply
    const reply = await generateEmberChatReply({
      emberId: emberContributor.emberId,
      sessionId: session.id,
      role: 'contributor',
      trigger: 'photo_upload',
    });

    await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: reply,
        source: 'web',
      },
    });

    return NextResponse.json({
      ok: true,
      response: reply,
      attachment,
    });
  } catch (error) {
    console.error('Contributor upload error:', error);
    if (isPromptRemovedError(error)) {
      return NextResponse.json({ error: PROMPT_REMOVED_MESSAGE }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
  }
}
