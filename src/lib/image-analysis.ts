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

// Stripped image analysis: the only thing we ask the model for is the number of
// people visible in the photo. Everything else in ParsedVisionAnalysis stays in
// the type so downstream consumers compile, but they will receive empty/null.
const VISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['numberOfPeopleVisible'],
  properties: {
    numberOfPeopleVisible: {
      anyOf: [{ type: 'number' }, { type: 'null' }],
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

  // Stripped analysis: only numberOfPeopleVisible is asked for. All other fields
  // remain in the type for downstream compatibility but resolve to empty/null.
  const sceneInsights: ParsedVisionAnalysis['sceneInsights'] = {
    ...EMPTY_SCENE_INSIGHTS,
    peopleAndDemographics: {
      ...EMPTY_SCENE_INSIGHTS.peopleAndDemographics,
      numberOfPeopleVisible: sanitizeNumber(record.numberOfPeopleVisible),
    },
  };

  return {
    title: '',
    visualDescription: '',
    mood: '',
    peopleObserved: [],
    placeSignals: [],
    notableThings: [],
    activities: [],
    visibleText: [],
    searchableKeywords: [],
    openQuestions: [],
    sceneInsights,
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

const IMAGE_ANALYSIS_REPAIR_PROMPT = `You repair malformed JSON responses for an image-analysis pipeline. Return JSON only. Preserve grounded details, and use short neutral fallbacks, null, or [] when fields are missing.`;

const IMAGE_ANALYSIS_PROMPT = `Count the number of people visible in this image.

Return JSON only, matching this schema exactly:
{{schemaJson}}

Rules:
- "numberOfPeopleVisible" is a non-negative integer.
- If you cannot determine a count with reasonable confidence, return null.
- Count any clearly visible person, even if partially in frame.
- Do not return any other fields.`;

async function repairVisionJson(responseText: string): Promise<unknown> {
  const repairSource = extractBalancedJsonObject(responseText) || sanitizeJsonCandidate(responseText);
  const openai = getOpenAIClient();
  const repairPrompt = await renderPromptTemplate('image_analysis.repair', IMAGE_ANALYSIS_REPAIR_PROMPT);
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
            text: `Repair this malformed JSON so it becomes valid JSON and matches the required schema exactly.\n\nMalformed JSON:\n${repairSource}`,
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
  const conciseInstructions = conciseMode
    ? `Keep each string concise.
Limit arrays to the strongest items.
Prefer null over long speculative prose.`
    : '';
  const analysisPrompt = await renderPromptTemplate(promptKey, IMAGE_ANALYSIS_PROMPT, {
    schemaJson: JSON.stringify(VISION_SCHEMA),
    originalName,
    userDescription: userDescription || 'None provided.',
    metadataSummary: metadataSummary || 'No metadata available.',
    modeInstruction: conciseMode
      ? 'Be brief enough that the full response remains compact and valid JSON.'
      : 'Write naturally, but keep the JSON compact and valid.',
    conciseInstructions,
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
          summary: null,
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
