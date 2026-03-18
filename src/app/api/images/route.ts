import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { requireApiUser } from '@/lib/auth-server';
import { getAcceptedFriendIds } from '@/lib/ember-access';
import {
  ensureOwnerContributorForImage,
  ensureOwnerContributorsForOwnedImages,
} from '@/lib/owner-contributor';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { getUploadPath, getUploadsDir, inferMediaType } from '@/lib/uploads';
import { generatePosterFrame, probeVideo } from '@/lib/video-processing';

function describeVideoProcessingError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('ffmpeg') ||
      message.includes('ffprobe') ||
      message.includes('enoent')
    ) {
      return 'Video uploaded, but poster-frame processing failed because ffmpeg/ffprobe is not available on the server';
    }

    return `Video uploaded, but poster-frame processing failed: ${error.message}`;
  }

  return 'Video uploaded, but poster-frame processing failed';
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string;
    const shareToNetwork = (formData.get('shareToNetwork') as string | null) === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const mediaType = inferMediaType(file.name, file.type);
    if (!mediaType) {
      return NextResponse.json(
        { error: 'Only images and MP4, MOV, WEBM, or M4V videos are supported' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext) {
      return NextResponse.json({ error: 'File extension is required' }, { status: 400 });
    }
    const filename = `${randomUUID()}.${ext}`;
    const filePath = getUploadPath(filename);
    let posterFilename: string | null = null;
    let durationSeconds: number | null = null;
    let videoProcessingWarning: string | null = null;

    // Ensure uploads directory exists
    const uploadsDir = getUploadsDir();
    await mkdir(uploadsDir, { recursive: true });

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    try {
      if (mediaType === 'VIDEO') {
        const posterBase = `${randomUUID()}.jpg`;
        const posterPath = getUploadPath(posterBase);
        const videoMetadata = await probeVideo(filePath);
        await generatePosterFrame({
          inputPath: filePath,
          outputPath: posterPath,
          durationSeconds: videoMetadata.durationSeconds,
        });
        posterFilename = posterBase;
        durationSeconds = videoMetadata.durationSeconds;
      }
    } catch (processingError) {
      console.error('Video processing error:', processingError);
      if (posterFilename) {
        await unlink(getUploadPath(posterFilename)).catch(() => undefined);
        posterFilename = null;
      }
      durationSeconds = null;
      videoProcessingWarning = describeVideoProcessingError(processingError);
    }

    // Create database record
    const image = await prisma.image.create({
      data: {
        ownerId: auth.user.id,
        filename,
        mediaType,
        posterFilename,
        durationSeconds,
        originalName: file.name,
        description: description || null,
        shareToNetwork,
      },
    });

    await ensureOwnerContributorForImage(image.id, auth.user.id);

    let wikiGenerated = false;
    let warning: string | null = null;

    try {
      await generateWikiForImage(image.id);
      wikiGenerated = true;
    } catch (error) {
      console.error('Auto wiki generation failed:', error);
      warning =
        error instanceof Error
          ? error.message
          : `${mediaType === 'VIDEO' ? 'Video' : 'Image'} uploaded, but the automatic wiki could not be generated`;
    }

    if (videoProcessingWarning) {
      warning = warning ? `${videoProcessingWarning}. ${warning}` : videoProcessingWarning;
    }

    return NextResponse.json({ id: image.id, mediaType, wikiGenerated, warning });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload media' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const friendIds = await getAcceptedFriendIds(auth.user.id);
    await ensureOwnerContributorsForOwnedImages(auth.user.id);

    const images = await prisma.image.findMany({
      where: {
        OR: [
          { ownerId: auth.user.id },
          { contributors: { some: { userId: auth.user.id } } },
          ...(friendIds.length > 0
            ? [{ shareToNetwork: true, ownerId: { in: friendIds } }]
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contributors: {
          where: { userId: auth.user.id },
          select: { id: true },
          take: 1,
        },
        _count: {
          select: { contributors: true, tags: true },
        },
        wiki: {
          select: { id: true },
        },
      },
    });

    return NextResponse.json(
      images.map((image) => ({
        id: image.id,
        filename: image.filename,
        mediaType: image.mediaType,
        posterFilename: image.posterFilename,
        durationSeconds: image.durationSeconds,
        originalName: image.originalName,
        title: image.title,
        description: image.description,
        createdAt: image.createdAt,
        shareToNetwork: image.shareToNetwork,
        owner: image.owner,
        accessType:
          image.ownerId === auth.user.id
            ? 'owner'
            : image.contributors.length > 0
              ? 'contributor'
              : 'network',
        _count: image._count,
        wiki: image.wiki,
      }))
    );
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}
