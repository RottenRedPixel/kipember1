import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess, getImageAccessType } from '@/lib/ember-access';
import { prisma } from '@/lib/db';
import {
  parseSportsHighlightsJson,
  parseSportsModeInput,
  parseSportsModeJson,
} from '@/lib/sports-mode';
import { generateWikiForImage } from '@/lib/wiki-generator';

function cleanOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function serializeSportsMode(
  sportsMode: {
    id: string;
    sportType: string | null;
    subjectName: string | null;
    teamName: string | null;
    opponentName: string | null;
    eventName: string | null;
    season: string | null;
    outcome: string | null;
    finalScore: string | null;
    rawDetails: string;
    summary: string | null;
    statLinesJson: string | null;
    highlightsJson: string | null;
    updatedAt: Date;
  } | null
) {
  if (!sportsMode) {
    return null;
  }

  return {
    id: sportsMode.id,
    sportType: sportsMode.sportType,
    subjectName: sportsMode.subjectName,
    teamName: sportsMode.teamName,
    opponentName: sportsMode.opponentName,
    eventName: sportsMode.eventName,
    season: sportsMode.season,
    outcome: sportsMode.outcome,
    finalScore: sportsMode.finalScore,
    rawDetails: sportsMode.rawDetails,
    summary: sportsMode.summary,
    statLines: parseSportsModeJson(sportsMode.statLinesJson),
    highlights: parseSportsHighlightsJson(sportsMode.highlightsJson),
    updatedAt: sportsMode.updatedAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageId } = await params;
    const accessType = await getImageAccessType(auth.user.id, imageId);

    if (!accessType) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const image = await prisma.image.findUnique({
      where: { id: imageId },
      include: {
        sportsMode: true,
        wiki: {
          select: {
            id: true,
            version: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    return NextResponse.json({
      image: {
        id: image.id,
        filename: image.filename,
        mediaType: image.mediaType,
        posterFilename: image.posterFilename,
        durationSeconds: image.durationSeconds,
        originalName: image.originalName,
        description: image.description,
      },
      canManage: accessType === 'owner',
      wiki: image.wiki,
      sportsMode: serializeSportsMode(image.sportsMode),
    });
  } catch (error) {
    console.error('Error fetching sports mode:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sports mode' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageId } = await params;
    const image = await ensureImageOwnerAccess(auth.user.id, imageId);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await request.json();
    const rawDetails = cleanOptionalString(body?.rawDetails);

    if (!rawDetails) {
      return NextResponse.json(
        { error: 'Sports details are required' },
        { status: 400 }
      );
    }

    const parsed = await parseSportsModeInput({
      sportTypeHint: cleanOptionalString(body?.sportType),
      subjectNameHint: cleanOptionalString(body?.subjectName),
      teamNameHint: cleanOptionalString(body?.teamName),
      opponentNameHint: cleanOptionalString(body?.opponentName),
      eventNameHint: cleanOptionalString(body?.eventName),
      seasonHint: cleanOptionalString(body?.season),
      rawDetails,
    });

    const sportsMode = await prisma.sportsMode.upsert({
      where: { imageId },
      update: {
        sportType: parsed.sportType,
        subjectName: parsed.subjectName,
        teamName: parsed.teamName,
        opponentName: parsed.opponentName,
        eventName: parsed.eventName,
        season: parsed.season,
        outcome: parsed.outcome,
        finalScore: parsed.finalScore,
        rawDetails: parsed.rawDetails,
        summary: parsed.summary,
        statLinesJson: JSON.stringify(parsed.statLines),
        highlightsJson: JSON.stringify(parsed.highlights),
        parsedAt: new Date(),
      },
      create: {
        imageId,
        sportType: parsed.sportType,
        subjectName: parsed.subjectName,
        teamName: parsed.teamName,
        opponentName: parsed.opponentName,
        eventName: parsed.eventName,
        season: parsed.season,
        outcome: parsed.outcome,
        finalScore: parsed.finalScore,
        rawDetails: parsed.rawDetails,
        summary: parsed.summary,
        statLinesJson: JSON.stringify(parsed.statLines),
        highlightsJson: JSON.stringify(parsed.highlights),
        parsedAt: new Date(),
      },
    });

    let wikiGenerated = false;
    let warning: string | null = null;

    try {
      await generateWikiForImage(imageId);
      wikiGenerated = true;
    } catch (wikiError) {
      console.error('Sports mode wiki regeneration failed:', wikiError);
      warning =
        wikiError instanceof Error
          ? wikiError.message
          : 'Sports details were saved, but the wiki was not regenerated';
    }

    return NextResponse.json({
      sportsMode: serializeSportsMode(sportsMode),
      wikiGenerated,
      warning,
    });
  } catch (error) {
    console.error('Error saving sports mode:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save sports mode' },
      { status: 500 }
    );
  }
}
