import { readFile } from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import exifr from 'exifr';
import { prisma } from '@/lib/db';
import { getUploadPath, inferImageMimeType } from '@/lib/uploads';

type Confidence = 'high' | 'medium' | 'low';
type SupportedVisionMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

type VisualEntity = {
  label: string;
  details: string;
  confidence: Confidence;
};

type ParsedVisionAnalysis = {
  title: string;
  summary: string;
  visualDescription: string;
  mood: string;
  peopleObserved: VisualEntity[];
  placeSignals: VisualEntity[];
  notableThings: VisualEntity[];
  activities: string[];
  visibleText: string[];
  searchableKeywords: string[];
  openQuestions: string[];
};

type ParsedMetadata = {
  capturedAt: Date | null;
  latitude: number | null;
  longitude: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  software: string | null;
  width: number | null;
  height: number | null;
  orientation: string | null;
  exposureTime: string | null;
  fNumber: number | null;
  iso: number | null;
  focalLength: number | null;
  keywords: string[];
};

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const VISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'summary',
    'visualDescription',
    'mood',
    'peopleObserved',
    'placeSignals',
    'notableThings',
    'activities',
    'visibleText',
    'searchableKeywords',
    'openQuestions',
  ],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    visualDescription: { type: 'string' },
    mood: { type: 'string' },
    peopleObserved: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'details', 'confidence'],
        properties: {
          label: { type: 'string' },
          details: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    placeSignals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'details', 'confidence'],
        properties: {
          label: { type: 'string' },
          details: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    notableThings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'details', 'confidence'],
        properties: {
          label: { type: 'string' },
          details: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    activities: {
      type: 'array',
      items: { type: 'string' },
    },
    visibleText: {
      type: 'array',
      items: { type: 'string' },
    },
    searchableKeywords: {
      type: 'array',
      items: { type: 'string' },
    },
    openQuestions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} as const;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function stringifyJson(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  return JSON.stringify(value);
}

function sanitizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sanitizeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sanitizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== 'string') {
      return [];
    }

    const trimmed = item.trim();
    return trimmed ? [trimmed] : [];
  });
}

function sanitizeEntityList(value: unknown): VisualEntity[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const entity = item as Record<string, unknown>;
    const label = sanitizeString(entity.label);
    const details = sanitizeString(entity.details);
    const confidence =
      entity.confidence === 'high' || entity.confidence === 'medium' || entity.confidence === 'low'
        ? entity.confidence
        : null;

    if (!label || !details || !confidence) {
      return [];
    }

    return [{ label, details, confidence }];
  });
}

function normalizeVisionAnalysis(raw: unknown): ParsedVisionAnalysis {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  return {
    title: sanitizeString(record.title) || 'Uploaded Memory',
    summary:
      sanitizeString(record.summary) ||
      'A concise visual summary of the uploaded photo.',
    visualDescription:
      sanitizeString(record.visualDescription) ||
      'A visually grounded description of the uploaded image.',
    mood: sanitizeString(record.mood) || 'reflective',
    peopleObserved: sanitizeEntityList(record.peopleObserved),
    placeSignals: sanitizeEntityList(record.placeSignals),
    notableThings: sanitizeEntityList(record.notableThings),
    activities: sanitizeStringList(record.activities),
    visibleText: sanitizeStringList(record.visibleText),
    searchableKeywords: sanitizeStringList(record.searchableKeywords),
    openQuestions: sanitizeStringList(record.openQuestions),
  };
}

function formatExifDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  return null;
}

function formatExposureTime(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    if (value < 1) {
      return `1/${Math.round(1 / value)} sec`;
    }

    return `${value} sec`;
  }

  return null;
}

async function extractPhotoMetadata(buffer: Buffer): Promise<ParsedMetadata> {
  const raw = (await exifr.parse(buffer, {
    tiff: true,
    exif: true,
    gps: true,
    xmp: true,
    iptc: true,
    jfif: true,
    ihdr: true,
  })) as Record<string, unknown> | undefined;

  const keywords = [
    ...sanitizeStringList(raw?.Subject),
    ...sanitizeStringList(raw?.Keywords),
  ];

  return {
    capturedAt:
      formatExifDate(raw?.DateTimeOriginal) ||
      formatExifDate(raw?.CreateDate) ||
      formatExifDate(raw?.ModifyDate),
    latitude: sanitizeNumber(raw?.latitude),
    longitude: sanitizeNumber(raw?.longitude),
    cameraMake: sanitizeString(raw?.Make),
    cameraModel: sanitizeString(raw?.Model),
    lensModel: sanitizeString(raw?.LensModel),
    software: sanitizeString(raw?.Software),
    width:
      sanitizeNumber(raw?.ExifImageWidth) ||
      sanitizeNumber(raw?.ImageWidth),
    height:
      sanitizeNumber(raw?.ExifImageHeight) ||
      sanitizeNumber(raw?.ImageHeight),
    orientation: sanitizeString(raw?.Orientation),
    exposureTime: formatExposureTime(raw?.ExposureTime),
    fNumber: sanitizeNumber(raw?.FNumber),
    iso: sanitizeNumber(raw?.ISO),
    focalLength: sanitizeNumber(raw?.FocalLength),
    keywords: Array.from(new Set(keywords)),
  };
}

function buildMetadataSummary(metadata: ParsedMetadata): string | null {
  const parts: string[] = [];

  if (metadata.capturedAt) {
    parts.push(`Captured on ${metadata.capturedAt.toISOString().slice(0, 10)}.`);
  }

  if (metadata.cameraMake || metadata.cameraModel) {
    parts.push(
      `Camera: ${[metadata.cameraMake, metadata.cameraModel].filter(Boolean).join(' ')}.`
    );
  }

  if (metadata.lensModel) {
    parts.push(`Lens: ${metadata.lensModel}.`);
  }

  if (metadata.width && metadata.height) {
    parts.push(`Dimensions: ${metadata.width}x${metadata.height}.`);
  }

  if (metadata.latitude != null && metadata.longitude != null) {
    parts.push(
      `GPS coordinates embedded: ${metadata.latitude.toFixed(5)}, ${metadata.longitude.toFixed(5)}.`
    );
  }

  if (metadata.exposureTime || metadata.fNumber || metadata.iso || metadata.focalLength) {
    const exposureDetails = [
      metadata.exposureTime ? `Exposure ${metadata.exposureTime}` : null,
      metadata.fNumber ? `f/${metadata.fNumber}` : null,
      metadata.iso ? `ISO ${metadata.iso}` : null,
      metadata.focalLength ? `${metadata.focalLength}mm` : null,
    ].filter(Boolean);

    if (exposureDetails.length > 0) {
      parts.push(`${exposureDetails.join(', ')}.`);
    }
  }

  if (metadata.keywords.length > 0) {
    parts.push(`Embedded keywords: ${metadata.keywords.join(', ')}.`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

function toBase64ImageSource(buffer: Buffer, mimeType: string) {
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/png':
    case 'image/gif':
    case 'image/webp':
      return {
        type: 'base64' as const,
        media_type: mimeType as SupportedVisionMimeType,
        data: buffer.toString('base64'),
      };
    default:
      return null;
  }
}

async function analyzeImageVisually({
  buffer,
  mimeType,
  originalName,
  userDescription,
  metadataSummary,
}: {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  userDescription: string | null;
  metadataSummary: string | null;
}): Promise<ParsedVisionAnalysis> {
  requiredEnv('ANTHROPIC_API_KEY');

  const imageSource = toBase64ImageSource(buffer, mimeType);
  if (!imageSource) {
    throw new Error(`Visual analysis does not support ${mimeType}`);
  }

  const message = await anthropic.messages.parse({
    model: process.env.ANTHROPIC_IMAGE_ANALYSIS_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 1600,
    system: `You analyze uploaded personal photos for a memory wiki.

Your job is to describe what is visibly present in the photo and what it may indicate.

Rules:
- Be grounded in what is actually visible.
- Do not identify unknown private individuals by name from appearance alone.
- If the image suggests a recognizable landmark or place, express confidence honestly.
- Distinguish between strong visual evidence and softer inference.
- Treat the user's description and embedded metadata as supporting context, not proof of unseen facts.
- Favor specificity over generic captions.`,
    output_config: {
      format: {
        type: 'json_schema',
        schema: VISION_SCHEMA,
      },
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              `Filename: ${originalName}`,
              `User description: ${userDescription || 'None provided.'}`,
              `Metadata summary: ${metadataSummary || 'No metadata available.'}`,
              'Analyze the photo for a memory wiki. Return structured observations about visible people, places, objects, activities, mood, visible text, and open questions that future contributors could answer.',
            ].join('\n'),
          },
          {
            type: 'image',
            source: imageSource,
          },
        ],
      },
    ],
  });

  return normalizeVisionAnalysis(message.parsed_output);
}

function buildFallbackSummary({
  originalName,
  userDescription,
  metadataSummary,
}: {
  originalName: string;
  userDescription: string | null;
  metadataSummary: string | null;
}): string {
  const parts = [
    userDescription ? `User description: ${userDescription}.` : null,
    metadataSummary,
    `Uploaded file: ${originalName}.`,
  ].filter(Boolean);

  return parts.join(' ') || 'An uploaded image awaiting further visual analysis.';
}

export async function ensureImageAnalysisForImage(imageId: string) {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    include: { analysis: true },
  });

  if (!image) {
    throw new Error('Image not found');
  }

  if (image.analysis?.status === 'ready' || image.analysis?.status === 'partial') {
    return image.analysis;
  }

  const filePath = getUploadPath(image.filename);
  const buffer = await readFile(filePath);
  const mimeType = inferImageMimeType(image.originalName) || inferImageMimeType(image.filename);

  const existing = image.analysis
    ? await prisma.imageAnalysis.update({
        where: { id: image.analysis.id },
        data: {
          status: 'processing',
          errorMessage: null,
        },
      })
    : await prisma.imageAnalysis.create({
        data: {
          imageId,
          status: 'processing',
        },
      });

  try {
    const metadata = await extractPhotoMetadata(buffer);
    const metadataSummary = buildMetadataSummary(metadata);

    let vision: ParsedVisionAnalysis | null = null;
    let status: 'ready' | 'partial' = 'ready';
    let errorMessage: string | null = null;

    if (mimeType) {
      try {
        vision = await analyzeImageVisually({
          buffer,
          mimeType,
          originalName: image.originalName,
          userDescription: image.description,
          metadataSummary,
        });
      } catch (error) {
        status = 'partial';
        errorMessage =
          error instanceof Error ? error.message : 'Visual analysis was not completed';
      }
    } else {
      status = 'partial';
      errorMessage = 'Could not determine a supported image type for visual analysis';
    }

    return prisma.imageAnalysis.update({
      where: { id: existing.id },
      data: {
        status,
        errorMessage,
        summary:
          vision?.summary ||
          buildFallbackSummary({
            originalName: image.originalName,
            userDescription: image.description,
            metadataSummary,
          }),
        visualDescription: vision?.visualDescription || null,
        metadataSummary,
        mood: vision?.mood || null,
        peopleJson: stringifyJson(vision?.peopleObserved || []),
        placesJson: stringifyJson(vision?.placeSignals || []),
        thingsJson: stringifyJson(vision?.notableThings || []),
        activitiesJson: stringifyJson(vision?.activities || []),
        visibleTextJson: stringifyJson(vision?.visibleText || []),
        keywordsJson: stringifyJson(
          Array.from(
            new Set([...(vision?.searchableKeywords || []), ...metadata.keywords])
          )
        ),
        openQuestionsJson: stringifyJson(vision?.openQuestions || []),
        metadataJson: stringifyJson({
          capturedAt: metadata.capturedAt?.toISOString() || null,
          latitude: metadata.latitude,
          longitude: metadata.longitude,
          cameraMake: metadata.cameraMake,
          cameraModel: metadata.cameraModel,
          lensModel: metadata.lensModel,
          software: metadata.software,
          width: metadata.width,
          height: metadata.height,
          orientation: metadata.orientation,
          exposureTime: metadata.exposureTime,
          fNumber: metadata.fNumber,
          iso: metadata.iso,
          focalLength: metadata.focalLength,
          keywords: metadata.keywords,
        }),
        capturedAt: metadata.capturedAt,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        cameraMake: metadata.cameraMake,
        cameraModel: metadata.cameraModel,
        lensModel: metadata.lensModel,
      },
    });
  } catch (error) {
    await prisma.imageAnalysis.update({
      where: { id: existing.id },
      data: {
        status: 'error',
        errorMessage:
          error instanceof Error ? error.message : 'Failed to analyze image',
      },
    });

    throw error;
  }
}
