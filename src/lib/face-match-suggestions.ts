import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { normalizeEmail, normalizePhone } from '@/lib/auth-server';
import { getCapabilityModel, renderPromptTemplate } from '@/lib/control-plane';
import { prisma } from '@/lib/db';
import { readUploadBuffer } from '@/lib/uploads';
import { getUserDisplayName } from '@/lib/user-name';

type Confidence = 'high' | 'medium' | 'low';

export type FaceBox = {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
};

export type FaceMatchSuggestion = FaceBox & {
  faceIndex: number;
  label: string;
  userId: string | null;
  contributorId: string | null;
  email: string | null;
  phoneNumber: string | null;
  confidence: Confidence;
  reason: string;
};

type CandidateGroup = {
  personKey: string;
  label: string;
  userId: string | null;
  contributorId: string | null;
  email: string | null;
  phoneNumber: string | null;
  references: Array<{
    image: {
      filename: string;
      mediaType: 'IMAGE' | 'VIDEO';
      posterFilename: string | null;
    };
    box: FaceBox;
  }>;
};

type CropVariant = 'tight' | 'expanded';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DEFAULT_FACE_MATCH_MODEL = 'claude-sonnet-4-20250514';

async function getFaceMatchModel() {
  return getCapabilityModel(
    'face_match',
    process.env.ANTHROPIC_FACE_MATCH_MODEL || DEFAULT_FACE_MATCH_MODEL
  );
}

const MAX_FACES_PER_IMAGE = 4;
const MAX_PEOPLE_TO_COMPARE = 4;
const MAX_REFERENCES_PER_PERSON = 1;
const FACE_CROP_SIZE = 192;
const TARGET_IMAGE_MAX_DIMENSION = 1280;

const FACE_MATCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['bestMatchPersonKey', 'confidence', 'reason'],
  properties: {
    bestMatchPersonKey: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
    },
    reason: {
      type: 'string',
    },
  },
} as const;

const FACE_VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['samePerson', 'confidence', 'reason'],
  properties: {
    samePerson: {
      type: 'boolean',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
    },
    reason: {
      type: 'string',
    },
  },
} as const;

function parseJsonFromText(text: string): unknown {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error('Face matching returned an empty response');
  }

  const withoutCodeFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutCodeFence);
  } catch {
    const firstBrace = withoutCodeFence.indexOf('{');
    const lastBrace = withoutCodeFence.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(withoutCodeFence.slice(firstBrace, lastBrace + 1));
    }

    throw new Error('Face matching returned invalid JSON');
  }
}

function sanitizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function confidenceRank(confidence: Confidence) {
  switch (confidence) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

function normalizeFaceBox(box: FaceBox): FaceBox {
  const leftPct = Math.max(0, Math.min(100, box.leftPct));
  const topPct = Math.max(0, Math.min(100, box.topPct));
  const widthPct = Math.max(1, Math.min(100, box.widthPct));
  const heightPct = Math.max(1, Math.min(100, box.heightPct));

  return {
    leftPct: Math.min(leftPct, 100 - widthPct),
    topPct: Math.min(topPct, 100 - heightPct),
    widthPct,
    heightPct,
  };
}

function expandFaceBox(box: FaceBox): FaceBox {
  const normalized = normalizeFaceBox(box);
  const widthPct = Math.max(18, Math.min(40, normalized.widthPct * 1.85));
  const heightPct = Math.max(22, Math.min(46, normalized.heightPct * 2.05));
  const centerX = normalized.leftPct + normalized.widthPct / 2;
  const centerY = normalized.topPct + normalized.heightPct / 2;

  return normalizeFaceBox({
    leftPct: centerX - widthPct / 2,
    topPct: centerY - heightPct / 2 - heightPct * 0.08,
    widthPct,
    heightPct,
  });
}

function isValidFaceBox(value: unknown): value is FaceBox {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const box = value as Record<string, unknown>;
  return (
    typeof box.leftPct === 'number' &&
    typeof box.topPct === 'number' &&
    typeof box.widthPct === 'number' &&
    typeof box.heightPct === 'number'
  );
}

function getSourceFilename(image: {
  filename: string;
  mediaType: 'IMAGE' | 'VIDEO';
  posterFilename: string | null;
}) {
  return image.mediaType === 'VIDEO' && image.posterFilename
    ? image.posterFilename
    : image.filename;
}

function buildIdentityKey(tag: {
  userId: string | null;
  email: string | null;
  phoneNumber: string | null;
  label: string;
}) {
  if (tag.userId) {
    return `user:${tag.userId}`;
  }

  const normalizedEmail = tag.email ? normalizeEmail(tag.email) : null;
  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }

  const normalizedPhone = normalizePhone(tag.phoneNumber);
  if (normalizedPhone) {
    return `phone:${normalizedPhone}`;
  }

  const normalizedLabel = tag.label.trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalizedLabel) {
    return `label:${normalizedLabel}`;
  }

  return null;
}

function buildCandidateLabel(tag: {
  label: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
}) {
  return getUserDisplayName(tag.user) || tag.label || tag.user?.email || 'Known person';
}

async function cropFaceBuffer(
  image: {
    filename: string;
    mediaType: 'IMAGE' | 'VIDEO';
    posterFilename: string | null;
  },
  box: FaceBox,
  variant: CropVariant = 'tight'
) {
  const normalizedBox =
    variant === 'expanded' ? expandFaceBox(box) : normalizeFaceBox(box);
  const sourceFilename = getSourceFilename(image);
  const input = await readUploadBuffer(sourceFilename);
  const rotated = sharp(input).rotate();
  const metadata = await rotated.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Could not determine image dimensions for face crop');
  }

  const left = Math.max(
    0,
    Math.min(
      metadata.width - 1,
      Math.floor((normalizedBox.leftPct / 100) * metadata.width)
    )
  );
  const top = Math.max(
    0,
    Math.min(
      metadata.height - 1,
      Math.floor((normalizedBox.topPct / 100) * metadata.height)
    )
  );
  const availableWidth = Math.max(1, metadata.width - left);
  const availableHeight = Math.max(1, metadata.height - top);
  const requestedWidth = Math.max(
    1,
    Math.floor((normalizedBox.widthPct / 100) * metadata.width)
  );
  const requestedHeight = Math.max(
    1,
    Math.floor((normalizedBox.heightPct / 100) * metadata.height)
  );
  const width = Math.min(availableWidth, Math.max(32, requestedWidth));
  const height = Math.min(availableHeight, Math.max(32, requestedHeight));

  return rotated
    .extract({ left, top, width, height })
    .resize(FACE_CROP_SIZE, FACE_CROP_SIZE, {
      fit: 'cover',
      position: 'attention',
    })
    .jpeg({ quality: 78 })
    .toBuffer();
}

async function loadCandidateReferenceImages(candidate: CandidateGroup) {
  const referenceImages: Buffer[] = [];

  for (const reference of candidate.references) {
    const variants: CropVariant[] = ['tight', 'expanded'];

    for (const variant of variants) {
      try {
        const buffer = await cropFaceBuffer(reference.image, reference.box, variant);
        referenceImages.push(buffer);
      } catch {
        // Skip bad historical crops instead of failing the whole candidate.
      }
    }
  }

  return {
    ...candidate,
    referenceImages,
  };
}

async function loadCandidatesWithReferences(referenceCandidates: CandidateGroup[]) {
  const loadedCandidates: Array<
    CandidateGroup & {
      referenceImages: Buffer[];
    }
  > = [];

  for (const candidate of referenceCandidates) {
    const loadedCandidate = await loadCandidateReferenceImages(candidate);
    if (loadedCandidate.referenceImages.length > 0) {
      loadedCandidates.push(loadedCandidate);
    }
  }

  return loadedCandidates;
}

async function repairFaceMatchJson(responseText: string): Promise<unknown> {
  const systemPrompt = await renderPromptTemplate('image_analysis.initial_photo', '', {
    task: 'face_match_repair',
    schemaJson: JSON.stringify(FACE_MATCH_SCHEMA),
  });
  const repairMessage = await anthropic.messages.create({
    model: await getFaceMatchModel(),
    max_tokens: 800,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      },
    ],
  });

  const repairedText = repairMessage.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  return parseJsonFromText(repairedText);
}

async function repairFaceVerifyJson(responseText: string): Promise<unknown> {
  const systemPrompt = await renderPromptTemplate('image_analysis.initial_photo', '', {
    task: 'face_verify_repair',
    schemaJson: JSON.stringify(FACE_VERIFY_SCHEMA),
  });
  const repairMessage = await anthropic.messages.create({
    model: await getFaceMatchModel(),
    max_tokens: 800,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      },
    ],
  });

  const repairedText = repairMessage.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  return parseJsonFromText(repairedText);
}

async function compareFaceToCandidates(
  targetFaces: Buffer[],
  candidates: Array<
    CandidateGroup & {
      referenceImages: Buffer[];
    }
  >
): Promise<{
  bestMatchPersonKey: string | null;
  confidence: Confidence;
  reason: string;
}> {
  const candidateKeys = new Set(candidates.map((candidate) => candidate.personKey));
  const content: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: 'text',
      text: 'target',
    },
  ];

  targetFaces.forEach((targetFace, index) => {
    content.push({
      type: 'text',
      text: `Target crop ${index + 1}`,
    });
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: targetFace.toString('base64'),
      },
    });
  });

  candidates.forEach((candidate, index) => {
    content.push({
      type: 'text',
      text: `Candidate ${index + 1}\npersonKey: ${candidate.personKey}\nlabel: ${candidate.label}`,
    });

    candidate.referenceImages.forEach((referenceImage, referenceIndex) => {
      content.push({
        type: 'text',
        text: `Reference ${referenceIndex + 1} for ${candidate.label}`,
      });
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: referenceImage.toString('base64'),
        },
      });
    });
  });

  const systemPrompt = await renderPromptTemplate('image_analysis.initial_photo', '', {
    task: 'face_match',
    schemaJson: JSON.stringify(FACE_MATCH_SCHEMA),
  });
  const response = await anthropic.messages.create({
    model: await getFaceMatchModel(),
    max_tokens: 900,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  });

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  let parsed: unknown;

  try {
    parsed = parseJsonFromText(responseText);
  } catch {
    parsed = await repairFaceMatchJson(responseText);
  }

  const record = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  const bestMatchPersonKey = sanitizeString(record.bestMatchPersonKey);
  const confidence =
    record.confidence === 'high' ||
    record.confidence === 'medium' ||
    record.confidence === 'low'
      ? record.confidence
      : 'low';
  const reason = sanitizeString(record.reason) || '';

  return {
    bestMatchPersonKey:
      bestMatchPersonKey && candidateKeys.has(bestMatchPersonKey) ? bestMatchPersonKey : null,
    confidence,
    reason,
  };
}

async function verifyFaceAgainstCandidate(
  targetFaces: Buffer[],
  candidate: CandidateGroup & {
    referenceImages: Buffer[];
  }
): Promise<{
  samePerson: boolean;
  confidence: Confidence;
  reason: string;
}> {
  const content: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: 'text',
      text: `candidate: ${candidate.label}`,
    },
  ];

  targetFaces.forEach((targetFace, index) => {
    content.push({
      type: 'text',
      text: `Target crop ${index + 1}`,
    });
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: targetFace.toString('base64'),
      },
    });
  });

  candidate.referenceImages.forEach((referenceImage, index) => {
    content.push({
      type: 'text',
      text: `Reference crop ${index + 1} for ${candidate.label}`,
    });
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: referenceImage.toString('base64'),
      },
    });
  });

  const systemPrompt = await renderPromptTemplate('image_analysis.initial_photo', '', {
    task: 'face_verify',
    schemaJson: JSON.stringify(FACE_VERIFY_SCHEMA),
  });
  const response = await anthropic.messages.create({
    model: await getFaceMatchModel(),
    max_tokens: 900,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  });

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  let parsed: unknown;

  try {
    parsed = parseJsonFromText(responseText);
  } catch {
    parsed = await repairFaceVerifyJson(responseText);
  }

  const record = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  const samePerson = record.samePerson === true;
  const confidence =
    record.confidence === 'high' ||
    record.confidence === 'medium' ||
    record.confidence === 'low'
      ? record.confidence
      : 'low';
  const reason = sanitizeString(record.reason) || '';

  return {
    samePerson,
    confidence,
    reason,
  };
}

async function getReferenceCandidates(ownerId: string, imageId: string) {
  const tags = await prisma.imageTag.findMany({
    where: {
      imageId: { not: imageId },
      image: {
        ownerId,
      },
      leftPct: { not: null },
      topPct: { not: null },
      widthPct: { not: null },
      heightPct: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      image: {
        select: {
          filename: true,
          mediaType: true,
          posterFilename: true,
        },
      },
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  const grouped = new Map<string, CandidateGroup>();

  for (const tag of tags) {
    if (tag.image.mediaType === 'AUDIO') {
      continue;
    }

    const referenceImage = {
      filename: tag.image.filename,
      mediaType: tag.image.mediaType,
      posterFilename: tag.image.posterFilename,
    } as const;

    const personKey = buildIdentityKey(tag);
    if (!personKey) {
      continue;
    }

    const existing = grouped.get(personKey);
    if (existing) {
      if (existing.references.length < MAX_REFERENCES_PER_PERSON) {
        existing.references.push({
          image: referenceImage,
          box: {
            leftPct: tag.leftPct!,
            topPct: tag.topPct!,
            widthPct: tag.widthPct!,
            heightPct: tag.heightPct!,
          },
        });
      }
      continue;
    }

    grouped.set(personKey, {
      personKey,
      label: buildCandidateLabel(tag),
      userId: tag.userId,
      contributorId: tag.emberContributorId,
      email: tag.email,
      phoneNumber: tag.phoneNumber,
      references: [
        {
          image: referenceImage,
          box: {
            leftPct: tag.leftPct!,
            topPct: tag.topPct!,
            widthPct: tag.widthPct!,
            heightPct: tag.heightPct!,
          },
        },
      ],
    });
  }

  return Array.from(grouped.values())
    .filter((candidate) => candidate.references.length > 0)
    .sort((left, right) => right.references.length - left.references.length)
    .slice(0, MAX_PEOPLE_TO_COMPARE);
}

async function loadTargetImageBuffer(image: {
  filename: string;
  mediaType: 'IMAGE' | 'VIDEO';
  posterFilename: string | null;
}) {
  const sourceFilename = getSourceFilename(image);
  const input = await readUploadBuffer(sourceFilename);

  return sharp(input)
    .rotate()
    .resize(TARGET_IMAGE_MAX_DIMENSION, TARGET_IMAGE_MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 78 })
    .toBuffer();
}

export async function suggestFaceMatchesForImage({
  ownerId,
  imageId,
  faces,
}: {
  ownerId: string;
  imageId: string;
  faces: FaceBox[];
}): Promise<FaceMatchSuggestion[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return [];
  }

  const normalizedFaces = faces
    .filter(isValidFaceBox)
    .map(normalizeFaceBox)
    .slice(0, MAX_FACES_PER_IMAGE);

  if (normalizedFaces.length === 0) {
    return [];
  }

  const image = await prisma.image.findFirst({
    where: {
      id: imageId,
      ownerId,
    },
    select: {
      id: true,
      filename: true,
      mediaType: true,
      posterFilename: true,
    },
  });

  if (!image || image.mediaType === 'AUDIO') {
    throw new Error('Image not found');
  }

  const visualImage = {
    filename: image.filename,
    mediaType: image.mediaType,
    posterFilename: image.posterFilename,
  } as const;

  const referenceCandidates = await getReferenceCandidates(ownerId, imageId);
  if (referenceCandidates.length === 0) {
    return [];
  }

  const loadedCandidates = await loadCandidatesWithReferences(referenceCandidates);

  if (loadedCandidates.length === 0) {
    return [];
  }

  const suggestions: FaceMatchSuggestion[] = [];

  for (const [faceIndex, face] of normalizedFaces.entries()) {
    const targetFaces = await Promise.all([
      cropFaceBuffer(visualImage, face, 'tight'),
      cropFaceBuffer(visualImage, face, 'expanded'),
    ]);
    let match: (typeof loadedCandidates)[number] | undefined;
    let verification:
      | {
          samePerson: boolean;
          confidence: Confidence;
          reason: string;
        }
      | undefined;

    if (loadedCandidates.length <= 3) {
      const verifiedCandidates = (
        await Promise.all(
          loadedCandidates.map(async (candidate) => ({
            candidate,
            verification: await verifyFaceAgainstCandidate(targetFaces, candidate),
          }))
        )
      )
        .filter((entry) => entry.verification.samePerson)
        .sort(
          (left, right) =>
            confidenceRank(right.verification.confidence) -
            confidenceRank(left.verification.confidence)
        );

      if (verifiedCandidates.length === 0) {
        continue;
      }

      match = verifiedCandidates[0]?.candidate;
      verification = verifiedCandidates[0]?.verification;
    } else {
      const comparison = await compareFaceToCandidates(targetFaces, loadedCandidates);

      if (!comparison.bestMatchPersonKey) {
        continue;
      }

      match = loadedCandidates.find(
        (candidate) => candidate.personKey === comparison.bestMatchPersonKey
      );

      if (!match) {
        continue;
      }

      verification = await verifyFaceAgainstCandidate(targetFaces, match);
      if (!verification.samePerson) {
        continue;
      }
    }

    if (!match || !verification) {
      continue;
    }

    suggestions.push({
      faceIndex,
      leftPct: face.leftPct,
      topPct: face.topPct,
      widthPct: face.widthPct,
      heightPct: face.heightPct,
      label: match.label,
      userId: match.userId,
      contributorId: match.contributorId,
      email: match.email,
      phoneNumber: match.phoneNumber,
      confidence: verification.confidence,
      reason: verification.reason,
    });
  }

  return suggestions;
}

/**
 * Auto-tag pipeline (combined detect + match in a single Claude vision call).
 *
 * For each visible face in the target image, returns:
 * - the bounding box (always)
 * - identity fields populated from a reference candidate when matched
 *   (contributorId / userId / label / email / phoneNumber / confidence)
 * - or all identity fields null when no candidate matched.
 *
 * Cold-start (no reference candidates) skips the candidate context
 * entirely and acts as plain face detection.
 */

const MAX_CANDIDATES_FOR_AUTO_TAG = 10;

export type DetectedFaceWithMatch = FaceBox & {
  /** Populated when the face matched a reference candidate. */
  contributorId: string | null;
  userId: string | null;
  label: string | null;
  email: string | null;
  phoneNumber: string | null;
  confidence: Confidence | null;
  reason: string | null;
};

export async function detectAndMatchFacesInImage({
  ownerId,
  imageId,
}: {
  ownerId: string;
  imageId: string;
}): Promise<DetectedFaceWithMatch[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const image = await prisma.image.findFirst({
    where: { id: imageId, ownerId },
    select: { filename: true, mediaType: true, posterFilename: true },
  });
  if (!image || image.mediaType === 'AUDIO') return [];

  const targetImage = await loadTargetImageBuffer({
    filename: image.filename,
    mediaType: image.mediaType,
    posterFilename: image.posterFilename,
  });

  const allReferenceCandidates = await getReferenceCandidates(ownerId, imageId);
  const referenceCandidates = allReferenceCandidates.slice(0, MAX_CANDIDATES_FOR_AUTO_TAG);
  const loadedCandidates =
    referenceCandidates.length > 0 ? await loadCandidatesWithReferences(referenceCandidates) : [];
  const candidatesByKey = new Map(loadedCandidates.map((c) => [c.personKey, c]));

  const candidatesPreamble =
    loadedCandidates.length === 0
      ? 'There are no reference candidates. Set personKey to null for every detected face.'
      : `You have ${loadedCandidates.length} reference candidate(s) listed below the target image. For each detected face in the target, decide if it is the same person as one of the candidates and set personKey accordingly. Use null when there is no match.`;

  const systemPrompt = `You are a face detector and identifier.

You will receive a TARGET image, and ${loadedCandidates.length} reference CANDIDATE(s), each with a personKey label and example image(s) showing that person.

${candidatesPreamble}

Return ONLY a JSON object with this exact shape (no markdown, no commentary):

{
  "faces": [
    {
      "leftPct": <number 0-100>,
      "topPct": <number 0-100>,
      "widthPct": <number 0-100>,
      "heightPct": <number 0-100>,
      "personKey": <string|null>,
      "confidence": <"high"|"medium"|"low"|null>,
      "reason": <string|null>
    }
  ]
}

Rules:
- Detect EVERY visible human face in the target — matched or not
- Bounding box should be tight (forehead to chin, ear to ear) using percentages of the target image's full dimensions
- "high" confidence = certain it's the same person; "medium" = likely; "low" = guess
- Set personKey to null if the face does not clearly match any listed candidate
- If you set personKey, it MUST be one of the keys you were given
- Order does not matter`;

  const content: Anthropic.Messages.ContentBlockParam[] = [
    { type: 'text', text: 'TARGET image (find all faces here):' },
    {
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: targetImage.toString('base64') },
    },
  ];

  for (const candidate of loadedCandidates) {
    content.push({
      type: 'text',
      text: `CANDIDATE — personKey: ${candidate.personKey} — name: ${candidate.label}`,
    });
    for (const referenceImage of candidate.referenceImages.slice(0, 2)) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: referenceImage.toString('base64'),
        },
      });
    }
  }

  const response = await anthropic.messages.create({
    model: await getFaceMatchModel(),
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
  });

  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  let parsed: unknown;
  try {
    parsed = parseJsonFromText(responseText);
  } catch {
    return [];
  }

  const record = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  const rawFaces = Array.isArray(record.faces) ? record.faces : [];

  const detected: DetectedFaceWithMatch[] = [];
  for (const raw of rawFaces) {
    const item = raw as Record<string, unknown>;
    if (
      typeof item.leftPct !== 'number' ||
      typeof item.topPct !== 'number' ||
      typeof item.widthPct !== 'number' ||
      typeof item.heightPct !== 'number' ||
      item.widthPct <= 0 ||
      item.heightPct <= 0
    ) {
      continue;
    }

    const box = normalizeFaceBox({
      leftPct: item.leftPct,
      topPct: item.topPct,
      widthPct: item.widthPct,
      heightPct: item.heightPct,
    });

    const personKey = sanitizeString(item.personKey);
    const candidate = personKey ? candidatesByKey.get(personKey) : undefined;
    const confidence =
      item.confidence === 'high' || item.confidence === 'medium' || item.confidence === 'low'
        ? (item.confidence as Confidence)
        : null;
    const reason = sanitizeString(item.reason);

    if (candidate && confidence && confidence !== 'low') {
      detected.push({
        ...box,
        contributorId: candidate.contributorId,
        userId: candidate.userId,
        label: candidate.label,
        email: candidate.email,
        phoneNumber: candidate.phoneNumber,
        confidence,
        reason,
      });
    } else {
      detected.push({
        ...box,
        contributorId: null,
        userId: null,
        label: null,
        email: null,
        phoneNumber: null,
        confidence: null,
        reason: null,
      });
    }
  }

  return detected;
}
