import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-server';
import { ensureOwnerContributorForImage } from '@/lib/owner-contributor';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { ensureImageAnalysisForImage } from '@/lib/image-analysis';
import { persistUploadedMedia } from '@/lib/media-upload';
import {
  getAccessibleEmbersForUser,
  invalidateAccessibleEmbersForUser,
} from '@/lib/ember';
import { generateSnapshotScript } from '@/lib/claude';
import { loadEmberSetupContext } from '@/lib/ember-setup-context';

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

    let persistedMedia;
    try {
      persistedMedia = await persistUploadedMedia(file);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Only images and MP4, MOV, WEBM, or M4V videos are supported',
        },
        { status: 400 }
      );
    }

    // Create database record
    const image = await prisma.image.create({
      data: {
        ownerId: auth.user.id,
        filename: persistedMedia.filename,
        mediaType: persistedMedia.mediaType,
        posterFilename: persistedMedia.posterFilename,
        durationSeconds: persistedMedia.durationSeconds,
        originalName: file.name,
        description: description || null,
        shareToNetwork,
      },
    });

    await ensureOwnerContributorForImage(image.id, auth.user.id);
    invalidateAccessibleEmbersForUser(auth.user.id);

    // All heavy work — image analysis, wiki, snapshot — runs in the background
    // so the POST returns immediately. The UI shows its sequenced loader for
    // ~10s and then opens the ember view; the title and wiki populate as the
    // background work finishes (HomeScreen polls for the title to appear).
    void (async () => {
      try {
        await ensureImageAnalysisForImage(image.id);
      } catch (error) {
        console.error('Image analysis at create time failed:', error);
        return;
      }

      try {
        await generateWikiForImage(image.id);
      } catch (error) {
        console.error('Auto wiki generation failed:', error);
      }

      try {
        const context = await loadEmberSetupContext(image.id);
        if (context) {
          const { imageTitle: title, image: imageRecord, confirmedPeople, confirmedLocation, contributorMemories, callSummaries, callHighlights } = context;
          const summary = imageRecord.analysis?.summary || null;
          const location = confirmedLocation?.label ?? null;
          const script = await generateSnapshotScript({
            title,
            summary,
            location,
            durationSeconds: 5,
            taggedPeople: confirmedPeople,
            wikiContent: imageRecord.wiki?.content ?? null,
            contributorMemories: contributorMemories.map((m) => ({ contributorName: m.contributorName, answer: m.answer })),
            callSummaries: callSummaries.map((c) => ({ contributorName: c.contributorName, summary: c.summary })),
            callHighlights: callHighlights.map((h) => ({ contributorName: h.contributorName, title: h.title, quote: h.quote })),
            promptKey: 'snapshot_generation.initial',
          });
          if (script.trim()) {
            await prisma.snapshot.create({
              data: {
                imageId: image.id,
                title,
                style: 'documentary',
                focus: '',
                durationSeconds: 5,
                wordCount: script.split(/\s+/).filter(Boolean).length,
                script,
                blocksJson: '[]',
                selectedMediaJson: '[]',
                selectedContributorJson: '[]',
                includeOwner: true,
                includeEmberVoice: true,
                includeNarratorVoice: false,
              },
            });
          }
        }
      } catch (error) {
        console.error('Auto snapshot generation failed:', error);
      }
    })();

    return NextResponse.json({
      id: image.id,
      mediaType: persistedMedia.mediaType,
      warning: persistedMedia.warning ?? null,
      image: {
        id: image.id,
        filename: image.filename,
        mediaType: image.mediaType,
        posterFilename: image.posterFilename,
        durationSeconds: image.durationSeconds,
        originalName: image.originalName,
        title: image.title,
        description: image.description,
        createdAt: image.createdAt,
        capturedAt: null,
        shareToNetwork: image.shareToNetwork,
        accessType: 'owner',
        photoCount: 1,
        contributorCount: 0,
        hasWiki: false,
        hasLocation: false,
        hasVoiceCall: false,
      },
    });
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

    return NextResponse.json(await getAccessibleEmbersForUser(auth.user.id));
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}
