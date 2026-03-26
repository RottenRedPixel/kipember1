import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import {
  generateStoryCut,
  getStoryCutStyleOptions,
  type StoryCutStyle,
} from '@/lib/story-cuts';
import { loadEmberSetupContext } from '@/lib/ember-setup-context';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

const VALID_STYLES = new Set<StoryCutStyle>(
  getStoryCutStyleOptions().map((option) => option.value)
);

function parseStyle(value: unknown): StoryCutStyle {
  return typeof value === 'string' && VALID_STYLES.has(value as StoryCutStyle)
    ? (value as StoryCutStyle)
    : 'documentary';
}

function parseDuration(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 10;
  }

  return Math.max(5, Math.min(60, Math.round(value)));
}

function parseFocus(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : 'The emotional heart of the moment';
}

function parseOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0
        )
        .map((item) => item.trim())
    : [];
}

function parseBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
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
    const image = await ensureImageOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const context = await loadEmberSetupContext(id);

    if (!context) {
      return NextResponse.json({ error: 'Ember not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const style = parseStyle(body?.style);
    const durationSeconds = parseDuration(body?.durationSeconds);
    const storyFocus = parseFocus(body?.storyFocus);
    const storyTitle = parseOptionalString(body?.storyTitle) || context.imageTitle;
    const selectedMediaIds = parseStringArray(body?.selectedMediaIds);
    const selectedContributorIds = parseStringArray(body?.selectedContributorIds);
    const includeOwner = parseBoolean(body?.includeOwner, true);
    const includeEmberVoice = parseBoolean(body?.includeEmberVoice, true);
    const includeNarratorVoice = parseBoolean(body?.includeNarratorVoice, true);
    const emberVoiceId = parseOptionalString(body?.emberVoiceId);
    const emberVoiceLabel = parseOptionalString(body?.emberVoiceLabel);
    const narratorVoiceId = parseOptionalString(body?.narratorVoiceId);
    const narratorVoiceLabel = parseOptionalString(body?.narratorVoiceLabel);

    const storyCut = await generateStoryCut(context, {
      style,
      durationSeconds,
      storyFocus,
      storyTitle,
      selectedMediaIds,
      selectedContributorIds,
      includeOwner,
      includeEmberVoice,
      includeNarratorVoice,
      emberVoiceLabel: emberVoiceLabel || undefined,
      narratorVoiceLabel: narratorVoiceLabel || undefined,
    });

    await prisma.storyCut.upsert({
      where: { imageId: id },
      update: {
        title: storyCut.title,
        style: storyCut.style,
        focus: storyCut.metadata.focus,
        durationSeconds: Math.round(storyCut.duration),
        wordCount: Math.round(storyCut.wordCount),
        script: storyCut.script,
        blocksJson: JSON.stringify(storyCut.blocks),
        metadataJson: JSON.stringify(storyCut.metadata),
        selectedMediaJson: JSON.stringify(selectedMediaIds),
        selectedContributorJson: JSON.stringify(selectedContributorIds),
        includeOwner,
        includeEmberVoice,
        includeNarratorVoice,
        emberVoiceId,
        emberVoiceLabel,
        narratorVoiceId,
        narratorVoiceLabel,
      },
      create: {
        imageId: id,
        title: storyCut.title,
        style: storyCut.style,
        focus: storyCut.metadata.focus,
        durationSeconds: Math.round(storyCut.duration),
        wordCount: Math.round(storyCut.wordCount),
        script: storyCut.script,
        blocksJson: JSON.stringify(storyCut.blocks),
        metadataJson: JSON.stringify(storyCut.metadata),
        selectedMediaJson: JSON.stringify(selectedMediaIds),
        selectedContributorJson: JSON.stringify(selectedContributorIds),
        includeOwner,
        includeEmberVoice,
        includeNarratorVoice,
        emberVoiceId,
        emberVoiceLabel,
        narratorVoiceId,
        narratorVoiceLabel,
      },
    });

    return NextResponse.json({ storyCut });
  } catch (error) {
    console.error('Story Cuts generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate Story Cuts' },
      { status: 500 }
    );
  }
}
