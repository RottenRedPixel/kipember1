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
  sceneInsights: {
    peopleAndDemographics: {
      numberOfPeopleVisible: number | null;
      estimatedAgeRanges: string[];
      genderPresentation: string | null;
      clothingAndStyle: string | null;
      bodyLanguageAndExpressions: string | null;
      relationshipInference: string | null;
    };
    settingAndEnvironment: {
      locationType: string | null;
      timeOfDayAndLighting: string | null;
      weatherConditions: string | null;
      backgroundDetails: string | null;
      architectureOrLandscape: string | null;
    };
    activitiesAndContext: {
      whatAppearsToBeHappening: string | null;
      socialDynamics: string | null;
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
      socialEnergy: string | null;
    };
    storyElements: {
      storyThisImageTells: string | null;
      whatMightHaveHappenedBefore: string | null;
      whatMightHappenNext: string | null;
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
        'storyElements',
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
            relationshipInference: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
          },
        },
        settingAndEnvironment: {
          type: 'object',
          additionalProperties: false,
          required: [
            'locationType',
            'timeOfDayAndLighting',
            'weatherConditions',
            'backgroundDetails',
            'architectureOrLandscape',
          ],
          properties: {
            locationType: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            timeOfDayAndLighting: {
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
            'socialEnergy',
          ],
          properties: {
            overallMoodAndAtmosphere: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            emotionalExpressions: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            socialEnergy: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
          },
        },
        storyElements: {
          type: 'object',
          additionalProperties: false,
          required: [
            'storyThisImageTells',
            'whatMightHaveHappenedBefore',
            'whatMightHappenNext',
          ],
          properties: {
            storyThisImageTells: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            whatMightHaveHappenedBefore: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            whatMightHappenNext: {
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
    relationshipInference: null,
  },
  settingAndEnvironment: {
    locationType: null,
    timeOfDayAndLighting: null,
    weatherConditions: null,
    backgroundDetails: null,
    architectureOrLandscape: null,
  },
  activitiesAndContext: {
    whatAppearsToBeHappening: null,
    socialDynamics: null,
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
    socialEnergy: null,
  },
  storyElements: {
    storyThisImageTells: null,
    whatMightHaveHappenedBefore: null,
    whatMightHappenNext: null,
  },
};

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
  const story = record.storyElements as Record<string, unknown> | undefined;

  return {
    peopleAndDemographics: {
      ...EMPTY_SCENE_INSIGHTS.peopleAndDemographics,
      numberOfPeopleVisible: sanitizeNumber(people?.numberOfPeopleVisible),
      estimatedAgeRanges: sanitizeStringList(people?.estimatedAgeRanges),
      genderPresentation: sanitizeNullableString(people?.genderPresentation),
      clothingAndStyle: sanitizeNullableString(people?.clothingAndStyle),
      bodyLanguageAndExpressions: sanitizeNullableString(people?.bodyLanguageAndExpressions),
      relationshipInference: sanitizeNullableString(people?.relationshipInference),
    },
    settingAndEnvironment: {
      ...EMPTY_SCENE_INSIGHTS.settingAndEnvironment,
      locationType: sanitizeNullableString(setting?.locationType),
      timeOfDayAndLighting: sanitizeNullableString(setting?.timeOfDayAndLighting),
      weatherConditions: sanitizeNullableString(setting?.weatherConditions),
      backgroundDetails: sanitizeNullableString(setting?.backgroundDetails),
      architectureOrLandscape: sanitizeNullableString(setting?.architectureOrLandscape),
    },
    activitiesAndContext: {
      ...EMPTY_SCENE_INSIGHTS.activitiesAndContext,
      whatAppearsToBeHappening: sanitizeNullableString(activities?.whatAppearsToBeHappening),
      socialDynamics: sanitizeNullableString(activities?.socialDynamics),
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
      socialEnergy: sanitizeNullableString(emotional?.socialEnergy),
    },
    storyElements: {
      ...EMPTY_SCENE_INSIGHTS.storyElements,
      storyThisImageTells: sanitizeNullableString(story?.storyThisImageTells),
      whatMightHaveHappenedBefore: sanitizeNullableString(story?.whatMightHaveHappenedBefore),
      whatMightHappenNext: sanitizeNullableString(story?.whatMightHappenNext),
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

function extractMessageText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
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

async function repairVisionJson(responseText: string): Promise<unknown> {
  const repairSource = extractBalancedJsonObject(responseText) || sanitizeJsonCandidate(responseText);
  const repairMessage = await anthropic.messages.create({
    model: process.env.ANTHROPIC_IMAGE_ANALYSIS_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 2600,
    system: `You repair malformed JSON responses for an image-analysis pipeline.

Return valid JSON only. Do not add markdown, commentary, or code fences.
Preserve the original meaning as closely as possible.
If the source appears truncated or malformed, repair it into the required schema using concise neutral values instead of leaving broken JSON.
The repaired JSON must match this schema exactly:
${JSON.stringify(VISION_SCHEMA)}`,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Repair this malformed JSON so it becomes valid JSON and matches the required schema exactly.

Rules:
- Return JSON only.
- Preserve grounded details that are present.
- If a field is missing, use a short neutral fallback, null, or [] as appropriate.
- Do not copy any markdown fences.

Malformed JSON:
${repairSource}`,
          },
        ],
      },
    ],
  });

  return parseJsonFromText(extractMessageText(repairMessage.content));
}

async function requestVisionAnalysisText({
  buffer,
  mimeType,
  originalName,
  userDescription,
  metadataSummary,
  conciseMode,
}: {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  userDescription: string | null;
  metadataSummary: string | null;
  conciseMode: boolean;
}) {
  const imageSource = toBase64ImageSource(buffer, mimeType);
  if (!imageSource) {
    throw new Error(`Visual analysis does not support ${mimeType}`);
  }

  return anthropic.messages.create({
    model: process.env.ANTHROPIC_IMAGE_ANALYSIS_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: conciseMode ? 1900 : 2200,
    system: `You analyze uploaded personal photos for a memory wiki.

Your job is to describe what is visibly present in the photo and what it may indicate.

Rules:
- Be grounded in what is actually visible.
- Do not identify unknown private individuals by name from appearance alone.
- If the image suggests a recognizable landmark or place, express confidence honestly.
- Distinguish between strong visual evidence and softer inference.
- Treat the user's description and embedded metadata as supporting context, not proof of unseen facts.
- Favor specificity over generic captions.
- Set "title" to a short, natural Ember name in plain language.
- Never use the upload filename, file extension, or generic placeholders as the title.
- Return valid JSON only. Do not include markdown, commentary, or code fences.
- The JSON must match this schema exactly:
${JSON.stringify(VISION_SCHEMA)}
${conciseMode ? `
- Keep each string concise.
- Limit arrays to the strongest 3-5 items.
- Prefer null over long speculative prose.` : ''}`,
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
              'Analyze the photo for a memory wiki.',
              'The title should read like a human memory label, not a filename.',
              'Return grounded structured observations about visible people, places, objects, activities, mood, visible text, open questions, and richer scene insights.',
              'In scene insights, include the kinds of fields a human reviewer would want: people/demographics, setting/environment, activities/context, technical photo observations, emotional tone, and likely story context.',
              'Be explicit when something is only an appearance-based inference instead of a confirmed fact.',
              conciseMode
                ? 'Be brief enough that the full response remains compact and valid JSON.'
                : 'Write naturally, but keep the JSON compact and valid.',
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

  const attemptModes = [false, true];
  let lastError: Error | null = null;

  for (const conciseMode of attemptModes) {
    const message = await requestVisionAnalysisText({
      buffer,
      mimeType,
      originalName,
      userDescription,
      metadataSummary,
      conciseMode,
    });
    const responseText = extractMessageText(message.content);

    if (message.stop_reason === 'max_tokens') {
      lastError = new Error('Visual analysis response was truncated before it finished');
      continue;
    }

    try {
      return normalizeVisionAnalysis(parseJsonFromText(responseText));
    } catch (parseError) {
      try {
        return normalizeVisionAnalysis(await repairVisionJson(responseText));
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
          summary:
            vision?.summary ||
            buildFallbackSummary({
              originalName:
                image.mediaType === 'VIDEO'
                  ? `${image.originalName} (video, analyzed from poster frame)`
                  : image.originalName,
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
