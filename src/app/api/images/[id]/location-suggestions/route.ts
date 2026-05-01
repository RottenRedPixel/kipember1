import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess } from '@/lib/ember';
import { prisma } from '@/lib/db';
import {
  getLocationSuggestionsForCoordinates,
  mergeConfirmedLocationContext,
  parseConfirmedLocationContext,
  type ConfirmedLocationContext,
} from '@/lib/location-suggestions';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { PROMPT_REMOVED_MESSAGE, isPromptRemovedError } from '@/lib/control-plane';

function safeParseJson(value: string | null | undefined, fallback: unknown) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const image = await ensureEmberOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const analysis = await prisma.imageAnalysis.findUnique({
      where: { imageId: id },
      select: {
        metadataJson: true,
        metadataSummary: true,
        visualDescription: true,
        summary: true,
        mood: true,
        placesJson: true,
        thingsJson: true,
        activitiesJson: true,
        visibleTextJson: true,
        latitude: true,
        longitude: true,
      },
    });

    const confirmedLocation = parseConfirmedLocationContext(analysis?.metadataJson);

    if (!analysis || analysis.latitude == null || analysis.longitude == null) {
      return NextResponse.json({
        suggestions: [],
        confirmedLocation,
      });
    }

    const suggestions = await getLocationSuggestionsForCoordinates({
      latitude: analysis.latitude,
      longitude: analysis.longitude,
      context: {
        metadataSummary: analysis.metadataSummary,
        visualAnalysis: {
          summary: analysis.summary,
          visualDescription: analysis.visualDescription,
          mood: analysis.mood,
          placeSignals: safeParseJson(analysis.placesJson, []),
          notableThings: safeParseJson(analysis.thingsJson, []),
          activities: safeParseJson(analysis.activitiesJson, []),
          visibleText: safeParseJson(analysis.visibleTextJson, []),
        },
      },
    });

    return NextResponse.json({
      suggestions,
      confirmedLocation,
    });
  } catch (error) {
    console.error('Location suggestion lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to load location suggestions' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const image = await ensureEmberOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const analysis = await prisma.imageAnalysis.findUnique({
      where: { imageId: id },
      select: {
        id: true,
        metadataJson: true,
        latitude: true,
        longitude: true,
      },
    });

    const body = (await request.json()) as Record<string, unknown>;
    const label =
      typeof body.label === 'string' && body.label.trim() ? body.label.trim() : null;
    const detail =
      typeof body.detail === 'string' && body.detail.trim() ? body.detail.trim() : null;
    const kind =
      typeof body.kind === 'string' && body.kind.trim() ? body.kind.trim() : 'place';
    const bodyLat = typeof body.latitude === 'number' ? body.latitude : null;
    const bodyLng = typeof body.longitude === 'number' ? body.longitude : null;
    const placeId =
      typeof body.placeId === 'string' && body.placeId.trim() ? body.placeId.trim() : null;
    const confidence =
      typeof body.confidence === 'string' && body.confidence.trim()
        ? body.confidence.trim()
        : null;
    const reason =
      typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;

    if (!label) {
      return NextResponse.json({ error: 'A location label is required' }, { status: 400 });
    }

    const resolvedLat = bodyLat ?? analysis?.latitude ?? null;
    const resolvedLng = bodyLng ?? analysis?.longitude ?? null;

    const confirmedLocation: ConfirmedLocationContext = {
      label,
      detail,
      kind,
      latitude: resolvedLat,
      longitude: resolvedLng,
      placeId,
      confidence,
      reason,
      confirmedAt: new Date().toISOString(),
    };

    await prisma.imageAnalysis.upsert({
      where: { imageId: id },
      update: {
        ...(bodyLat != null ? { latitude: bodyLat } : {}),
        ...(bodyLng != null ? { longitude: bodyLng } : {}),
        metadataJson: mergeConfirmedLocationContext({
          metadataJson: analysis?.metadataJson,
          context: confirmedLocation,
        }),
      },
      create: {
        imageId: id,
        status: 'partial',
        ...(bodyLat != null ? { latitude: bodyLat } : {}),
        ...(bodyLng != null ? { longitude: bodyLng } : {}),
        metadataJson: mergeConfirmedLocationContext({
          metadataJson: null,
          context: confirmedLocation,
        }),
      },
    });

    await generateWikiForImage(id);

    return NextResponse.json({
      success: true,
      confirmedLocation,
    });
  } catch (error) {
    console.error('Location suggestion save error:', error);
    if (isPromptRemovedError(error)) {
      return NextResponse.json({ error: PROMPT_REMOVED_MESSAGE }, { status: 500 });
    }
    return NextResponse.json(
      { error: 'Failed to save the selected location' },
      { status: 500 }
    );
  }
}
