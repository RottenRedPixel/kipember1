import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import {
  generateStoryCut,
  getStoryCutStyleOptions,
  type StoryCutStyle,
  type StoryCutResult,
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

function parseNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseMediaType(value: unknown): 'IMAGE' | 'VIDEO' | 'AUDIO' | null {
  return value === 'IMAGE' || value === 'VIDEO' || value === 'AUDIO' ? value : null;
}

type StoryCutBlockPayload =
  | {
      type: 'media';
      mediaId: string | null;
      mediaName: string | null;
      mediaUrl: string | null;
      mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | null;
      clipStartMs: number | null;
      clipEndMs: number | null;
      clipQuote: string | null;
      order: number;
    }
  | {
      type: 'voice';
      speaker: string | null;
      content: string | null;
      voicePreference: string | null;
      messageId: string | null;
      userId: string | null;
      order: number;
    };

function parseStoryCutBlocks(value: unknown): StoryCutBlockPayload[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const blocks: StoryCutBlockPayload[] = [];

  value.forEach((block, index) => {
    if (!block || typeof block !== 'object') {
      return;
    }

    const nextOrder = index + 1;

    if (block.type === 'voice') {
      blocks.push({
        type: 'voice',
        speaker: parseOptionalString(block.speaker),
        content: typeof block.content === 'string' ? block.content : null,
        voicePreference: parseOptionalString(block.voicePreference),
        messageId: parseOptionalString(block.messageId),
        userId: parseOptionalString(block.userId),
        order: nextOrder,
      });
      return;
    }

    if (block.type === 'media') {
      blocks.push({
        type: 'media',
        mediaId: parseOptionalString(block.mediaId),
        mediaName: parseOptionalString(block.mediaName),
        mediaUrl: parseOptionalString(block.mediaUrl),
        mediaType: parseMediaType(block.mediaType),
        clipStartMs: parseNullableNumber(block.clipStartMs),
        clipEndMs: parseNullableNumber(block.clipEndMs),
        clipQuote: parseOptionalString(block.clipQuote),
        order: nextOrder,
      });
    }
  });

  return blocks;
}

function getStyleLabel(style: StoryCutStyle) {
  return (
    getStoryCutStyleOptions().find((option) => option.value === style)?.label || 'Documentary'
  );
}

function buildFallbackStoryCut(
  context: NonNullable<Awaited<ReturnType<typeof loadEmberSetupContext>>>,
  options: {
    style: StoryCutStyle;
    durationSeconds: number;
    storyFocus: string;
    storyTitle: string;
    selectedMediaIds: string[];
    selectedContributorIds: string[];
    includeOwner: boolean;
    includeEmberVoice: boolean;
  }
): StoryCutResult {
  const selectedMediaIdSet = new Set(options.selectedMediaIds);
  const selectedContributorIdSet = new Set(options.selectedContributorIds);
  const isSelectedContributor = (contributorId: string, contributorUserId: string | null) => {
    const isOwnerContributor = contributorUserId === context.image.owner.id;

    if (isOwnerContributor) {
      return options.includeOwner;
    }

    if (selectedContributorIdSet.size === 0) {
      return true;
    }

    return selectedContributorIdSet.has(contributorId);
  };

  const selectedVoiceClips = context.callHighlights.filter(
    (clip) =>
      clip.audioUrl &&
      (selectedMediaIdSet.size === 0 || selectedMediaIdSet.has(clip.id)) &&
      isSelectedContributor(clip.contributorId, clip.contributorUserId)
  );

  const selectedAudioAttachments = context.image.attachments
    .filter((attachment) => attachment.mediaType === 'AUDIO')
    .filter(
      (attachment) =>
        selectedMediaIdSet.size === 0 || selectedMediaIdSet.has(attachment.id)
    );

  const firstMemoryNote =
    context.contributorMemories.find((memory) =>
      isSelectedContributor(memory.contributorId, memory.contributorUserId)
    )?.answer?.trim() || '';
  const firstClipQuote = selectedVoiceClips[0]?.quote?.trim() || '';
  const analysisSummary = context.image.analysis?.summary?.trim() || '';
  const locationLabel = context.confirmedLocation?.label?.trim() || '';

  const openerParts = [
    options.storyTitle,
    locationLabel ? `in ${locationLabel}` : null,
    analysisSummary || firstMemoryNote || firstClipQuote || options.storyFocus,
  ].filter(Boolean);
  const opener = openerParts.join('. ').replace(/\.\s+\./g, '.').trim();

  const closing =
    firstClipQuote && firstClipQuote !== firstMemoryNote
      ? `A real recorded moment from this memory helps tell the story: "${firstClipQuote}".`
      : firstMemoryNote
        ? `One remembered detail stands out: ${firstMemoryNote}`
        : `This snapshot focuses on ${options.storyFocus.toLowerCase()}.`;

  const blocks: StoryCutResult['blocks'] = [
    {
      type: 'media',
      order: 1,
      mediaId: context.image.id,
      mediaName: context.image.originalName,
      mediaUrl: null,
      mediaType: context.image.mediaType,
      clipStartMs: null,
      clipEndMs: null,
      clipQuote: null,
    },
  ];

  let order = 2;

  if (options.includeEmberVoice) {
    blocks.push({
      type: 'voice',
      order: order++,
      speaker: 'Ember',
      content: opener,
      voicePreference: 'Ember',
      messageId: null,
      userId: null,
    });
  }

  for (const clip of selectedVoiceClips.slice(0, 3)) {
    blocks.push({
      type: 'media',
      order: order++,
      mediaId: clip.id,
      mediaName: clip.title,
      mediaUrl: clip.audioUrl,
      mediaType: 'AUDIO',
      clipStartMs: clip.startMs,
      clipEndMs: clip.endMs,
      clipQuote: clip.quote,
    });
  }

  for (const attachment of selectedAudioAttachments.slice(0, Math.max(0, 3 - selectedVoiceClips.length))) {
    blocks.push({
      type: 'media',
      order: order++,
      mediaId: attachment.id,
      mediaName: attachment.originalName,
      mediaUrl: `/api/uploads/${attachment.filename}`,
      mediaType: 'AUDIO',
      clipStartMs: null,
      clipEndMs: null,
      clipQuote: attachment.description?.trim() || null,
    });
  }

  if (options.includeEmberVoice) {
    blocks.push({
      type: 'voice',
      order: order++,
      speaker: 'Ember',
      content: closing,
      voicePreference: 'Ember',
      messageId: null,
      userId: null,
    });
  }

  const emberVoiceLines = blocks
    .filter(
      (
        block
      ): block is Extract<StoryCutResult['blocks'][number], { type: 'voice' }> =>
        block.type === 'voice' && typeof block.content === 'string'
    )
    .map((block) => block.content)
    .filter((line): line is string => typeof line === 'string' && line.trim().length > 0);

  return {
    title: options.storyTitle,
    style: getStyleLabel(options.style),
    duration: options.durationSeconds,
    wordCount: emberVoiceLines.join(' ').split(/\s+/).filter(Boolean).length,
    script: emberVoiceLines.join(' ').trim(),
    blocks,
    emberVoiceLines,
    narratorVoiceLines: [],
    ownerLines: [],
    contributorLines: [],
    metadata: {
      focus: options.storyFocus,
      emberTitle: options.storyTitle,
      styleApplied: getStyleLabel(options.style),
      totalContributors: context.contributorMemories.length,
      hasDirectQuotes: Boolean(firstClipQuote || firstMemoryNote),
    },
  };
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
    const includeNarratorVoice = false;
    const emberVoiceId = parseOptionalString(body?.emberVoiceId);
    const emberVoiceLabel = parseOptionalString(body?.emberVoiceLabel);
    const narratorVoiceId = null;
    const narratorVoiceLabel = null;

    let storyCut: StoryCutResult;
    try {
      storyCut = await generateStoryCut(context, {
        style,
        durationSeconds,
        storyFocus,
        storyTitle,
        selectedMediaIds,
        selectedContributorIds,
        includeOwner,
        includeEmberVoice,
        emberVoiceLabel: emberVoiceLabel || undefined,
      });
    } catch (generationError) {
      console.error('Story Cuts AI generation failed, using fallback:', generationError);
      storyCut = buildFallbackStoryCut(context, {
        style,
        durationSeconds,
        storyFocus,
        storyTitle,
        selectedMediaIds,
        selectedContributorIds,
        includeOwner,
        includeEmberVoice,
      });
    }

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

export async function PATCH(
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

    const body = await request.json().catch(() => ({}));
    const script =
      typeof body?.script === 'string' && body.script.trim() ? body.script.trim() : '';
    const title =
      typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : null;
    const blocks = parseStoryCutBlocks(body?.blocks);

    if (!script) {
      return NextResponse.json({ error: 'Snapshot script is required' }, { status: 400 });
    }

    const existing = await prisma.storyCut.findUnique({
      where: { imageId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Generate a snapshot before editing it' }, { status: 404 });
    }

    const updated = await prisma.storyCut.update({
      where: { imageId: id },
      data: {
        script,
        title: title || existing.title,
        wordCount: script.split(/\s+/).filter(Boolean).length,
        blocksJson: blocks ? JSON.stringify(blocks) : existing.blocksJson,
      },
      select: {
        id: true,
        title: true,
        style: true,
        focus: true,
        durationSeconds: true,
        wordCount: true,
        script: true,
        blocksJson: true,
        metadataJson: true,
        selectedMediaJson: true,
        selectedContributorJson: true,
        includeOwner: true,
        includeEmberVoice: true,
        includeNarratorVoice: true,
        emberVoiceId: true,
        emberVoiceLabel: true,
        narratorVoiceId: true,
        narratorVoiceLabel: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      storyCut: {
        id: updated.id,
        title: updated.title,
        style: updated.style,
        focus: updated.focus,
        durationSeconds: updated.durationSeconds,
        wordCount: updated.wordCount,
        script: updated.script,
        blocks: JSON.parse(updated.blocksJson || '[]'),
        metadata: updated.metadataJson ? JSON.parse(updated.metadataJson) : null,
        selectedMediaIds: updated.selectedMediaJson ? JSON.parse(updated.selectedMediaJson) : [],
        selectedContributorIds: updated.selectedContributorJson
          ? JSON.parse(updated.selectedContributorJson)
          : [],
        includeOwner: updated.includeOwner,
        includeEmberVoice: updated.includeEmberVoice,
        includeNarratorVoice: updated.includeNarratorVoice,
        emberVoiceId: updated.emberVoiceId,
        emberVoiceLabel: updated.emberVoiceLabel,
        narratorVoiceId: updated.narratorVoiceId,
        narratorVoiceLabel: updated.narratorVoiceLabel,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Story Cuts update error:', error);
    return NextResponse.json(
      { error: 'Failed to update Snapshot' },
      { status: 500 }
    );
  }
}
