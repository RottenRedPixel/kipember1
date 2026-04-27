import { readFile } from 'fs/promises';
import exifr from 'exifr';
import sharp from 'sharp';
import { prisma } from '@/lib/db';
import { renderPromptTemplate } from '@/lib/control-plane';
import { getConfiguredOpenAIModel, getImageAnalysisModel, getOpenAIClient } from '@/lib/openai';
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
  sceneInsights: {
    peopleAndDemographics: {
      numberOfPeopleVisible: number | null;
      estimatedAgeRanges: string[];
      genderPresentation: string | null;
      clothingAndStyle: string | null;
      bodyLanguageAndExpressions: string | null;
      spatialRelationships: string | null;
      relationshipInference: string | null;
    };
    settingAndEnvironment: {
      environmentType: string | null;
      locationType: string | null;
      timeOfDayAndLighting: string | null;
      lightingDescription: string | null;
      weatherConditions: string | null;
      backgroundDetails: string | null;
      architectureOrLandscape: string | null;
    };
    activitiesAndContext: {
      whatAppearsToBeHappening: string | null;
      socialDynamics: string | null;
      interactionsBetweenPeople: string | null;
      eventType: string | null;
      visibleActivities: string[];
    };
    technicalDetails: {
      photoQualityAndComposition: string | null;
      lightingAnalysis: string | null;
      notablePhotographicElements: string | null;
      objectsOfInterest: string[];
    };
    emotionalContext: {
      overallMoodAndAtmosphere: string | null;
      emotionalExpressions: string | null;
      individualEmotions: string | null;
      energyLevel: string | null;
      socialEnergy: string | null;
    };
  };
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

const MAX_VISION_BASE64_BYTES = 5 * 1024 * 1024;
const TARGET_VISION_BASE64_BYTES = Math.floor(4.6 * 1024 * 1024);

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
    'sceneInsights',
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
    sceneInsights: {
      type: 'object',
      additionalProperties: false,
      required: [
        'peopleAndDemographics',
        'settingAndEnvironment',
        'activitiesAndContext',
        'technicalDetails',
        'emotionalContext',
      ],
      properties: {
        peopleAndDemographics: {
          type: 'object',
          additionalProperties: false,
          required: [
            'numberOfPeopleVisible',
            'estimatedAgeRanges',
            'genderPresentation',
            'clothingAndStyle',
            'bodyLanguageAndExpressions',
            'spatialRelationships',
            'relationshipInference',
          ],
          properties: {
            numberOfPeopleVisible: {
              anyOf: [{ type: 'number' }, { type: 'null' }],
            },
            estimatedAgeRanges: {
              type: 'array',
              items: { type: 'string' },
            },
            genderPresentation: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            clothingAndStyle: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            bodyLanguageAndExpressions: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            spatialRelationships: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            relationshipInference: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
          },
        },
        settingAndEnvironment: {
          type: 'object',
          additionalProperties: false,
          required: [
            'environmentType',
            'locationType',
            'timeOfDayAndLighting',
            'lightingDescription',
            'weatherConditions',
            'backgroundDetails',
            'architectureOrLandscape',
          ],
          properties: {
            environmentType: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            locationType: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            timeOfDayAndLighting: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            lightingDescription: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            weatherConditions: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            backgroundDetails: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            architectureOrLandscape: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
          },
        },
        activitiesAndContext: {
          type: 'object',
          additionalProperties: false,
          required: [
            'whatAppearsToBeHappening',
            'socialDynamics',
            'interactionsBetweenPeople',
            'eventType',
            'visibleActivities',
          ],
          properties: {
            whatAppearsToBeHappening: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            socialDynamics: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            interactionsBetweenPeople: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            eventType: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            visibleActivities: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        technicalDetails: {
          type: 'object',
          additionalProperties: false,
          required: [
            'photoQualityAndComposition',
            'lightingAnalysis',
            'notablePhotographicElements',
            'objectsOfInterest',
          ],
          properties: {
            photoQualityAndComposition: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            lightingAnalysis: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            notablePhotographicElements: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            objectsOfInterest: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        emotionalContext: {
          type: 'object',
          additionalProperties: false,
          required: [
            'overallMoodAndAtmosphere',
            'emotionalExpressions',
            'individualEmotions',
            'energyLevel',
            'socialEnergy',
          ],
          properties: {
            overallMoodAndAtmosphere: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            emotionalExpressions: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            individualEmotions: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            energyLevel: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            socialEnergy: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
          },
        },
      },
    },
  },
} as const;

const EMPTY_SCENE_INSIGHTS: ParsedVisionAnalysis['sceneInsights'] = {
  peopleAndDemographics: {
    numberOfPeopleVisible: null,
    estimatedAgeRanges: [],
    genderPresentation: null,
    clothingAndStyle: null,
    bodyLanguageAndExpressions: null,
    spatialRelationships: null,
    relationshipInference: null,
  },
  settingAndEnvironment: {
    environmentType: null,
    locationType: null,
    timeOfDayAndLighting: null,
    lightingDescription: null,
    weatherConditions: null,
    backgroundDetails: null,
    architectureOrLandscape: null,
  },
  activitiesAndContext: {
    whatAppearsToBeHappening: null,
    socialDynamics: null,
    interactionsBetweenPeople: null,
    eventType: null,
    visibleActivities: [],
  },
  technicalDetails: {
    photoQualityAndComposition: null,
    lightingAnalysis: null,
    notablePhotographicElements: null,
    objectsOfInterest: [],
  },
  emotionalContext: {
    overallMoodAndAtmosphere: null,
    emotionalExpressions: null,
    individualEmotions: null,
    energyLevel: null,
    socialEnergy: null,
  },
};

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

function sanitizeNullableString(value: unknown): string | null {
  return value === null ? null : sanitizeString(value);
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

function normalizeSceneInsights(value: unknown): ParsedVisionAnalysis['sceneInsights'] {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  const people = record.peopleAndDemographics as Record<string, unknown> | undefined;
  const setting = record.settingAndEnvironment as Record<string, unknown> | undefined;
  const activities = record.activitiesAndContext as Record<string, unknown> | undefined;
  const technical = record.technicalDetails as Record<string, unknown> | undefined;
  const emotional = record.emotionalContext as Record<string, unknown> | undefined;

  return {
    peopleAndDemographics: {
      ...EMPTY_SCENE_INSIGHTS.peopleAndDemographics,
      numberOfPeopleVisible: sanitizeNumber(people?.numberOfPeopleVisible),
      estimatedAgeRanges: sanitizeStringList(people?.estimatedAgeRanges),
      genderPresentation: sanitizeNullableString(people?.genderPresentation),
      clothingAndStyle: sanitizeNullableString(people?.clothingAndStyle),
      bodyLanguageAndExpressions: sanitizeNullableString(people?.bodyLanguageAndExpressions),
      spatialRelationships: sanitizeNullableString(people?.spatialRelationships),
      relationshipInference: sanitizeNullableString(people?.relationshipInference),
    },
    settingAndEnvironment: {
      ...EMPTY_SCENE_INSIGHTS.settingAndEnvironment,
      environmentType: sanitizeNullableString(setting?.environmentType),
      locationType: sanitizeNullableString(setting?.locationType),
      timeOfDayAndLighting: sanitizeNullableString(setting?.timeOfDayAndLighting),
      lightingDescription: sanitizeNullableString(setting?.lightingDescription),
      weatherConditions: sanitizeNullableString(setting?.weatherConditions),
      backgroundDetails: sanitizeNullableString(setting?.backgroundDetails),
      architectureOrLandscape: sanitizeNullableString(setting?.architectureOrLandscape),
    },
    activitiesAndContext: {
      ...EMPTY_SCENE_INSIGHTS.activitiesAndContext,
      whatAppearsToBeHappening: sanitizeNullableString(activities?.whatAppearsToBeHappening),
      socialDynamics: sanitizeNullableString(activities?.socialDynamics),
      interactionsBetweenPeople: sanitizeNullableString(activities?.interactionsBetweenPeople),
      eventType: sanitizeNullableString(activities?.eventType),
      visibleActivities: sanitizeStringList(activities?.visibleActivities),
    },
    technicalDetails: {
      ...EMPTY_SCENE_INSIGHTS.technicalDetails,
      photoQualityAndComposition: sanitizeNullableString(technical?.photoQualityAndComposition),
      lightingAnalysis: sanitizeNullableString(technical?.lightingAnalysis),
      notablePhotographicElements: sanitizeNullableString(technical?.notablePhotographicElements),
      objectsOfInterest: sanitizeStringList(technical?.objectsOfInterest),
    },
    emotionalContext: {
      ...EMPTY_SCENE_INSIGHTS.emotionalContext,
      overallMoodAndAtmosphere: sanitizeNullableString(emotional?.overallMoodAndAtmosphere),
      emotionalExpressions: sanitizeNullableString(emotional?.emotionalExpressions),
      individualEmotions: sanitizeNullableString(emotional?.individualEmotions),
      energyLevel: sanitizeNullableString(emotional?.energyLevel),
      socialEnergy: sanitizeNullableString(emotional?.socialEnergy),
    },
  };
}

function normalizeVisionAnalysis(raw: unknown): ParsedVisionAnalysis {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  return {
    title: sanitizeString(record.title) || '',
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
    sceneInsights: normalizeSceneInsights(record.sceneInsights),
  };
}

type ExifDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseOffsetMinutes(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) {
    return null;
  }

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number.parseInt(match[2], 10);
  const minutes = Number.parseInt(match[3], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return sign * (hours * 60 + minutes);
}

function parseExifDateParts(value: unknown): ExifDateParts | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
      hour: value.getUTCHours(),
      minute: value.getUTCMinutes(),
      second: value.getUTCSeconds(),
    };
  }

  if (typeof value !== 'string') {
    return null;
  }

  const match = value
    .trim()
    .match(/^(\d{4})[:/-](\d{2})[:/-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    return null;
  }

  const parts = {
    year: Number.parseInt(match[1], 10),
    month: Number.parseInt(match[2], 10),
    day: Number.parseInt(match[3], 10),
    hour: Number.parseInt(match[4], 10),
    minute: Number.parseInt(match[5], 10),
    second: Number.parseInt(match[6] || '0', 10),
  };

  return Object.values(parts).every((part) => Number.isFinite(part)) ? parts : null;
}

async function getGoogleTimeZoneOffsetMinutes({
  latitude,
  longitude,
  timestampSeconds,
}: {
  latitude: number | null;
  longitude: number | null;
  timestampSeconds: number;
}) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey || latitude == null || longitude == null) {
    return null;
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/timezone/json');
    url.searchParams.set('location', `${latitude},${longitude}`);
    url.searchParams.set('timestamp', String(timestampSeconds));
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      status?: string;
      rawOffset?: number;
      dstOffset?: number;
    };
    if (payload.status !== 'OK') {
      return null;
    }

    return Math.round(((payload.rawOffset || 0) + (payload.dstOffset || 0)) / 60);
  } catch (error) {
    console.error('Google timezone lookup failed:', error);
    return null;
  }
}

async function formatExifDate({
  value,
  offsetValue,
  latitude,
  longitude,
}: {
  value: unknown;
  offsetValue?: unknown;
  latitude: number | null;
  longitude: number | null;
}): Promise<Date | null> {
  const parts = parseExifDateParts(value);
  if (!parts) {
    return null;
  }

  const naiveUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const offsetMinutes =
    parseOffsetMinutes(offsetValue) ??
    (await getGoogleTimeZoneOffsetMinutes({
      latitude,
      longitude,
      timestampSeconds: Math.floor(naiveUtcMs / 1000),
    }));

  if (offsetMinutes == null) {
    return new Date(naiveUtcMs);
  }

  return new Date(naiveUtcMs - offsetMinutes * 60_000);
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
  const latitude = sanitizeNumber(raw?.latitude);
  const longitude = sanitizeNumber(raw?.longitude);
  const capturedAt =
    (await formatExifDate({
      value: raw?.DateTimeOriginal,
      offsetValue: raw?.OffsetTimeOriginal || raw?.OffsetTime,
      latitude,
      longitude,
    })) ||
    (await formatExifDate({
      value: raw?.CreateDate,
      offsetValue: raw?.OffsetTimeDigitized || raw?.OffsetTime,
      latitude,
      longitude,
    })) ||
    (await formatExifDate({
      value: raw?.ModifyDate,
      offsetValue: raw?.OffsetTime,
      latitude,
      longitude,
    }));

  return {
    capturedAt,
    latitude,
    longitude,
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

async function prepareVisionImageBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mediaType: SupportedVisionMimeType } | null> {
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/png':
    case 'image/gif':
    case 'image/webp':
      break;
    default:
      return null;
  }

  if (Buffer.byteLength(buffer.toString('base64'), 'utf8') <= MAX_VISION_BASE64_BYTES) {
    return {
      buffer,
      mediaType: mimeType as SupportedVisionMimeType,
    };
  }

  const metadata = await sharp(buffer, { animated: false }).metadata();
  const largerDimension = Math.max(metadata.width || 0, metadata.height || 0);
  const maxDimensions = [2200, 1800, 1440, 1200, 960, 768];
  const qualities = [82, 74, 66, 58, 50, 42];

  let smallestCandidate: Buffer | null = null;

  for (const maxDimension of maxDimensions) {
    for (const quality of qualities) {
      let pipeline = sharp(buffer, { animated: false }).rotate();

      if (largerDimension > 0) {
        pipeline = pipeline.resize({
          width: maxDimension,
          height: maxDimension,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      const candidate = await pipeline
        .flatten({ background: '#ffffff' })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      if (!smallestCandidate || candidate.byteLength < smallestCandidate.byteLength) {
        smallestCandidate = candidate;
      }

      if (
        Buffer.byteLength(candidate.toString('base64'), 'utf8') <= TARGET_VISION_BASE64_BYTES
      ) {
        return {
          buffer: candidate,
          mediaType: 'image/jpeg',
        };
      }
    }
  }

  if (
    smallestCandidate &&
    Buffer.byteLength(smallestCandidate.toString('base64'), 'utf8') <= MAX_VISION_BASE64_BYTES
  ) {
    return {
      buffer: smallestCandidate,
      mediaType: 'image/jpeg',
    };
  }

  throw new Error(
    `Image is too large for visual analysis even after resizing (${buffer.byteLength} bytes).`
  );
}

async function toBase64ImageSource(buffer: Buffer, mimeType: string) {
  const prepared = await prepareVisionImageBuffer(buffer, mimeType);
  if (!prepared) {
    return null;
  }

  return `data:${prepared.mediaType};base64,${prepared.buffer.toString('base64')}`;
}

function stripMarkdownCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function sanitizeJsonCandidate(text: string): string {
  return stripMarkdownCodeFence(text)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
}

function extractBalancedJsonObject(text: string): string | null {
  const input = sanitizeJsonCandidate(text);
  const start = input.indexOf('{');

  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = start; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return input.slice(start, index + 1);
      }
    }
  }

  const fallbackEnd = input.lastIndexOf('}');
  if (fallbackEnd > start) {
    return input.slice(start, fallbackEnd + 1);
  }

  return input.slice(start);
}

function removeTrailingCommas(text: string): string {
  return text.replace(/,\s*([}\]])/g, '$1');
}

function parseJsonFromText(text: string): unknown {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error('Visual analysis returned an empty response');
  }

  const candidates = Array.from(
    new Set(
      [
        sanitizeJsonCandidate(trimmed),
        extractBalancedJsonObject(trimmed),
        removeTrailingCommas(sanitizeJsonCandidate(trimmed)),
        extractBalancedJsonObject(removeTrailingCommas(trimmed)),
      ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()))
    )
  );

  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Visual analysis returned invalid JSON');
    }
  }

  try {
    const parsed = JSON.parse(trimmed);
    return parsed;
  } catch (error) {
    const detail =
      lastError?.message ||
      (error instanceof Error ? error.message : 'Visual analysis returned invalid JSON');
    throw new Error(`Visual analysis returned invalid JSON: ${detail}`);
  }
}

async function repairVisionJson(responseText: string, promptKey: string): Promise<unknown> {
  const repairSource = extractBalancedJsonObject(responseText) || sanitizeJsonCandidate(responseText);
  const openai = getOpenAIClient();
  const repairPrompt = await renderPromptTemplate(promptKey);
  const repairMessage = await openai.responses.create({
    model: await getConfiguredOpenAIModel('image_analysis', getImageAnalysisModel()),
    input: [
      {
        role: 'developer',
        type: 'message',
        content: [
          {
            type: 'input_text',
            text: repairPrompt,
          },
        ],
      },
      {
        role: 'user',
        type: 'message',
        content: [
          {
            type: 'input_text',
            text: repairSource,
          },
        ],
      },
    ],
    text: {
      verbosity: 'low',
      format: {
        type: 'json_schema',
        name: 'ember_image_analysis_repair',
        description: 'Repaired JSON for Ember image analysis.',
        schema: VISION_SCHEMA,
        strict: false,
      },
    },
  });

  return parseJsonFromText(repairMessage.output_text || '');
}

async function requestVisionAnalysisText({
  buffer,
  mimeType,
  originalName,
  userDescription,
  metadataSummary,
  conciseMode,
  promptKey,
}: {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  userDescription: string | null;
  metadataSummary: string | null;
  conciseMode: boolean;
  promptKey: string;
}) {
  const imageSource = await toBase64ImageSource(buffer, mimeType);
  if (!imageSource) {
    throw new Error(`Visual analysis does not support ${mimeType}`);
  }

  const openai = getOpenAIClient();
  const analysisPrompt = await renderPromptTemplate(promptKey, '', {
    schemaJson: JSON.stringify(VISION_SCHEMA),
    originalName,
    userDescription: userDescription || '',
    metadataSummary: metadataSummary || '',
    conciseMode,
  });

  const response = await openai.responses.create({
    model: await getConfiguredOpenAIModel('image_analysis', getImageAnalysisModel()),
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: analysisPrompt,
          },
          {
            type: 'input_image',
            image_url: imageSource,
            detail: conciseMode ? 'auto' : 'high',
          },
        ],
        type: 'message',
      },
    ],
    text: {
      verbosity: conciseMode ? 'low' : 'medium',
      format: {
        type: 'json_schema',
        name: 'ember_image_analysis',
        description: 'Structured image analysis for Ember memory creation.',
        schema: VISION_SCHEMA,
        strict: false,
      },
    },
  });

  return response.output_text || '';
}

async function analyzeImageVisually({
  buffer,
  mimeType,
  originalName,
  userDescription,
  metadataSummary,
  promptKey,
}: {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  userDescription: string | null;
  metadataSummary: string | null;
  promptKey: string;
}): Promise<ParsedVisionAnalysis> {
  const attemptModes = [false, true];
  let lastError: Error | null = null;

  for (const conciseMode of attemptModes) {
    let responseText = '';
    try {
      responseText = await requestVisionAnalysisText({
        buffer,
        mimeType,
        originalName,
        userDescription,
        metadataSummary,
        conciseMode,
        promptKey,
      });
    } catch (requestError) {
      lastError =
        requestError instanceof Error
          ? requestError
          : new Error('Visual analysis request failed');
      continue;
    }

    try {
      return normalizeVisionAnalysis(parseJsonFromText(responseText));
    } catch (parseError) {
      try {
        return normalizeVisionAnalysis(await repairVisionJson(responseText, promptKey));
      } catch (repairError) {
        lastError =
          repairError instanceof Error
            ? repairError
            : parseError instanceof Error
              ? parseError
              : new Error('Visual analysis returned invalid JSON');
      }
    }
  }

  throw lastError || new Error('Visual analysis was not completed');
}

export async function ensureImageAnalysisForImage(imageId: string) {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    include: { analysis: true },
  });

  if (!image) {
    throw new Error('Image not found');
  }

  const hasStoredEmberTitle = Boolean(image.title?.trim());
  const shouldReuseExistingAnalysis =
    hasStoredEmberTitle &&
    (image.analysis?.status === 'ready' ||
      (image.analysis?.status === 'partial' &&
        !!image.analysis.visualDescription &&
        !image.analysis.errorMessage?.includes('does not support output format')));

  if (shouldReuseExistingAnalysis) {
    return image.analysis;
  }

  const analysisFilename =
    image.mediaType === 'VIDEO' ? image.posterFilename || image.filename : image.filename;
  const filePath = getUploadPath(analysisFilename);
  const buffer = await readFile(filePath);
  const mimeType = inferImageMimeType(analysisFilename) || inferImageMimeType(image.originalName);

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
    const metadata =
      image.mediaType === 'VIDEO'
        ? {
            capturedAt: null,
            latitude: null,
            longitude: null,
            cameraMake: null,
            cameraModel: null,
            lensModel: null,
            software: null,
            width: null,
            height: null,
            orientation: null,
            exposureTime: null,
            fNumber: null,
            iso: null,
            focalLength: null,
            keywords: [],
          }
        : await extractPhotoMetadata(buffer);
    const baseMetadataSummary = buildMetadataSummary(metadata);
    const metadataSummary =
      image.mediaType === 'VIDEO'
        ? [
            image.durationSeconds
              ? `Video duration: ${Math.max(1, Math.round(image.durationSeconds))} seconds.`
              : null,
            'Visual analysis is based on a poster frame extracted from the uploaded video.',
            baseMetadataSummary,
          ]
            .filter(Boolean)
            .join(' ')
        : baseMetadataSummary;

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
          promptKey: 'image_analysis.initial_photo',
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

    const generatedTitle =
      vision?.title && vision.title.trim() ? vision.title.trim() : null;

    return prisma.$transaction(async (tx) => {
      if (generatedTitle) {
        await tx.image.update({
          where: { id: image.id },
          data: {
            title: generatedTitle,
          },
        });
      }

      return tx.imageAnalysis.update({
        where: { id: existing.id },
        data: {
          status,
          errorMessage,
          summary: vision?.summary || null,
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
          sceneInsightsJson: stringifyJson(vision?.sceneInsights || null),
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

/**
 * Full visual analysis for an image attachment uploaded via ember chat.
 * Returns a JSON-serialized ParsedVisionAnalysis for rich wiki display.
 */
export async function analyzeAttachmentImage(
  filename: string,
  originalName: string
): Promise<string | null> {
  try {
    const filePath = getUploadPath(filename);
    const buffer = await readFile(filePath);
    const mimeType = inferImageMimeType(filename) || inferImageMimeType(originalName);

    if (!mimeType) return null;

    const vision = await analyzeImageVisually({
      buffer,
      mimeType,
      originalName,
      userDescription: null,
      metadataSummary: null,
      promptKey: 'image_analysis.uploaded_photo',
    });

    return JSON.stringify(vision);
  } catch {
    return null;
  }
}
