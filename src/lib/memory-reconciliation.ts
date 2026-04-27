import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';
import { prisma } from '@/lib/db';
import { getEmberTitle } from '@/lib/ember-title';

type ExtractedClaim = {
  claimType?: unknown;
  subject?: unknown;
  value?: unknown;
  normalizedValue?: unknown;
  confidence?: unknown;
  evidenceKind?: unknown;
  resolutionMode?: unknown;
  rawText?: unknown;
};

type ReconciliationClaimSource = {
  sourceLabel: string;
  contributorId: string | null;
  userId: string | null;
  sessionId: string;
  source: string;
};

const VISUAL_REVIEW_CLAIM_TYPES = new Set([
  'object_visible',
  'clothing_color',
  'object_count',
  'person_present',
  'activity',
]);

const CONFLICT_ELIGIBLE_CLAIM_TYPES = new Set([
  'event_type',
  'date_time',
  'location',
  'relationship',
  'clothing_color',
  'object_count',
]);

function compactLines(lines: Array<string | null | undefined>) {
  return lines
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join('\n');
}

function normalizeComparableValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, ' ');
}

function normalizeType(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function normalizeSubject(value: string) {
  return normalizeComparableValue(value).slice(0, 160);
}

function clampConfidence(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(1, value));
}

function stringifyJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function parseJsonObject(text: string) {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('Expected a JSON object in reconciliation response');
  }

  return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as {
    claims?: ExtractedClaim[];
  };
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseExtractedClaims(text: string) {
  const parsed = parseJsonObject(text);
  if (!Array.isArray(parsed.claims)) {
    return [];
  }

  return parsed.claims.flatMap((claim) => {
    const claimType = normalizeType(stringValue(claim.claimType));
    const value = stringValue(claim.value);
    if (!claimType || !value) {
      return [];
    }

    const subject = normalizeSubject(stringValue(claim.subject));
    const normalizedValue =
      normalizeComparableValue(stringValue(claim.normalizedValue)) ||
      normalizeComparableValue(value);
    if (!normalizedValue) {
      return [];
    }

    const resolutionMode = stringValue(claim.resolutionMode) === 'visual_review'
      ? 'visual_review'
      : VISUAL_REVIEW_CLAIM_TYPES.has(claimType)
        ? 'visual_review'
        : 'human_clarification';

    return [
      {
        claimType,
        subject,
        value: value.slice(0, 500),
        normalizedValue: normalizedValue.slice(0, 240),
        confidence: clampConfidence(claim.confidence),
        evidenceKind: stringValue(claim.evidenceKind) || 'human_memory',
        resolutionMode,
        rawText: stringValue(claim.rawText).slice(0, 1000) || null,
      },
    ];
  });
}

function getSourceLabel(source: ReconciliationClaimSource) {
  return source.sourceLabel || 'Contributor';
}

function safeParseMetadata(value: string | null) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function claimSourceLabel(claim: { metadataJson: string | null }) {
  const metadata = safeParseMetadata(claim.metadataJson);
  return typeof metadata.sourceLabel === 'string' && metadata.sourceLabel.trim()
    ? metadata.sourceLabel.trim()
    : 'Someone';
}

function claimSourceKey(claim: {
  contributorId: string | null;
  userId: string | null;
  sourceSessionId: string | null;
  metadataJson: string | null;
}) {
  if (claim.userId) {
    return `user:${claim.userId}`;
  }

  if (claim.contributorId) {
    return `contributor:${claim.contributorId}`;
  }

  if (claim.sourceSessionId) {
    return `session:${claim.sourceSessionId}`;
  }

  return `label:${normalizeComparableValue(claimSourceLabel(claim))}`;
}

function summarizeClaimValues(
  claims: Array<{
    value: string;
    normalizedValue: string;
    metadataJson: string | null;
  }>
) {
  const valueByKey = new Map<string, { value: string; labels: string[] }>();

  for (const claim of claims) {
    const current = valueByKey.get(claim.normalizedValue) || {
      value: claim.value,
      labels: [],
    };
    const label = claimSourceLabel(claim);
    if (!current.labels.includes(label)) {
      current.labels.push(label);
    }
    valueByKey.set(claim.normalizedValue, current);
  }

  return Array.from(valueByKey.values());
}

function buildConflictSummary({
  claimType,
  subject,
  claims,
}: {
  claimType: string;
  subject: string;
  claims: Array<{
    value: string;
    normalizedValue: string;
    metadataJson: string | null;
  }>;
}) {
  const label = subject ? `${claimType.replace(/_/g, ' ')} for ${subject}` : claimType.replace(/_/g, ' ');
  const values = summarizeClaimValues(claims)
    .map((entry) => `${entry.labels.join(', ')} said "${entry.value}"`)
    .join('; ');

  return `Different recollections for ${label}: ${values}.`;
}

function buildOutreachQuestion(
  claims: Array<{
    value: string;
    normalizedValue: string;
    metadataJson: string | null;
  }>
) {
  const values = summarizeClaimValues(claims).slice(0, 4);
  const options = values.map((entry) => entry.value).join(' / ');

  return `We found different recollections for this memory: ${options}. Which sounds right, or is there a more nuanced answer?`;
}

function chooseResolutionMode(
  claims: Array<{
    resolutionMode: string;
  }>
) {
  return claims.every((claim) => claim.resolutionMode === 'visual_review')
    ? 'visual_review'
    : 'human_clarification';
}

async function createConflictForClaim(
  claim: Awaited<ReturnType<typeof prisma.memoryClaim.create>>
) {
  if (!CONFLICT_ELIGIBLE_CLAIM_TYPES.has(claim.claimType)) {
    return null;
  }

  const relatedClaims = await prisma.memoryClaim.findMany({
    where: {
      imageId: claim.imageId,
      claimType: claim.claimType,
      subject: claim.subject,
      status: 'active',
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const dedupedClaims = new Map<string, (typeof relatedClaims)[number]>();
  for (const relatedClaim of relatedClaims) {
    const key = [
      claimSourceKey(relatedClaim),
      relatedClaim.normalizedValue,
    ].join('|');

    if (!dedupedClaims.has(key)) {
      dedupedClaims.set(key, relatedClaim);
    }
  }

  const claims = Array.from(dedupedClaims.values());
  const distinctValues = new Set(claims.map((item) => item.normalizedValue));
  const distinctSources = new Set(claims.map((item) => claimSourceKey(item)));

  if (distinctValues.size < 2 || distinctSources.size < 2) {
    return null;
  }

  const summary = buildConflictSummary({
    claimType: claim.claimType,
    subject: claim.subject,
    claims,
  });
  const outreachQuestion = buildOutreachQuestion(claims);
  const resolutionMode = chooseResolutionMode(claims);
  const confidenceValues = claims
    .map((item) => item.confidence)
    .filter((item): item is number => typeof item === 'number');
  const confidence = confidenceValues.length
    ? Math.min(...confidenceValues)
    : null;

  const conflict =
    (await prisma.memoryConflict.findFirst({
      where: {
        imageId: claim.imageId,
        claimType: claim.claimType,
        subject: claim.subject,
        status: 'open',
      },
    })) ||
    (await prisma.memoryConflict.create({
      data: {
        imageId: claim.imageId,
        claimType: claim.claimType,
        subject: claim.subject,
        summary,
        outreachQuestion,
        resolutionMode,
        confidence,
        metadataJson: stringifyJson({
          distinctValues: Array.from(distinctValues),
        }),
      },
    }));

  await prisma.memoryConflict.update({
    where: {
      id: conflict.id,
    },
    data: {
      summary,
      outreachQuestion,
      resolutionMode,
      confidence,
      metadataJson: stringifyJson({
        distinctValues: Array.from(distinctValues),
      }),
    },
  });

  await prisma.memoryConflictClaim.deleteMany({
    where: {
      conflictId: conflict.id,
      claimId: {
        notIn: claims.map((item) => item.id),
      },
    },
  });

  await Promise.all(
    claims.map((item) =>
      prisma.memoryConflictClaim.upsert({
        where: {
          conflictId_claimId: {
            conflictId: conflict.id,
            claimId: item.id,
          },
        },
        update: {},
        create: {
          conflictId: conflict.id,
          claimId: item.id,
        },
      })
    )
  );

  return conflict.id;
}

export async function reconcileEmberMessage(messageId: string) {
  const message = await prisma.emberMessage.findUnique({
    where: {
      id: messageId,
    },
    include: {
      memoryClaims: {
        select: {
          id: true,
        },
      },
      session: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          contributor: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
            },
          },
          image: {
            include: {
              analysis: true,
            },
          },
        },
      },
    },
  });

  if (
    !message ||
    message.role !== 'user' ||
    !message.content.trim() ||
    !message.questionType ||
    message.memoryClaims.length > 0
  ) {
    return {
      claimsCreated: 0,
      conflictsCreated: 0,
    };
  }

  const source: ReconciliationClaimSource = {
    sourceLabel:
      message.session.user?.name ||
      message.session.contributor?.name ||
      message.session.user?.email ||
      message.session.contributor?.email ||
      message.session.contributor?.phoneNumber ||
      'Contributor',
    contributorId: message.session.contributorId,
    userId: message.session.userId,
    sessionId: message.sessionId,
    source: message.source,
  };

  const image = message.session.image;
  const systemPrompt = await renderPromptTemplate('ember_chat.style');
  const extractionContext = compactLines([
    `EMBER TITLE\n${getEmberTitle(image)}`,
    image.description ? `CAPTION\n${image.description}` : null,
    image.analysis?.summary ? `IMAGE SUMMARY\n${image.analysis.summary}` : null,
    image.analysis?.visualDescription
      ? `VISUAL DESCRIPTION\n${image.analysis.visualDescription}`
      : null,
    image.analysis?.sceneInsightsJson
      ? `SCENE INSIGHTS JSON\n${image.analysis.sceneInsightsJson}`
      : null,
    `CONTRIBUTOR\n${getSourceLabel(source)}`,
    `QUESTION TYPE\n${message.questionType}`,
    message.question ? `QUESTION\n${message.question}` : null,
    `ANSWER\n${message.content}`,
  ]);

  const response = await chat(
    systemPrompt,
    [
      {
        role: 'user',
        content: extractionContext,
      },
    ],
    {
      capabilityKey: 'ember_chat.style',
      maxTokens: 1600,
    }
  );
  const extractedClaims = parseExtractedClaims(response);
  const uniqueExtractedClaims = Array.from(
    new Map(
      extractedClaims.map((claim) => [
        [
          claim.claimType,
          claim.subject,
          claim.normalizedValue,
        ].join('|'),
        claim,
      ])
    ).values()
  );

  if (uniqueExtractedClaims.length === 0) {
    return {
      claimsCreated: 0,
      conflictsCreated: 0,
    };
  }

  const createdClaims = await Promise.all(
    uniqueExtractedClaims.map((claim) =>
      prisma.memoryClaim.create({
        data: {
          imageId: image.id,
          emberMessageId: message.id,
          contributorId: source.contributorId,
          userId: source.userId,
          sourceSessionId: source.sessionId,
          source: source.source || 'human_memory',
          questionType: message.questionType,
          claimType: claim.claimType,
          subject: claim.subject,
          value: claim.value,
          normalizedValue: claim.normalizedValue,
          rawText: claim.rawText,
          confidence: claim.confidence,
          evidenceKind: claim.evidenceKind,
          resolutionMode: claim.resolutionMode,
          metadataJson: stringifyJson({
            sourceLabel: getSourceLabel(source),
            messageCreatedAt: message.createdAt.toISOString(),
          }),
        },
      })
    )
  );

  const conflictIds = new Set<string>();
  for (const claim of createdClaims) {
    const conflictId = await createConflictForClaim(claim);
    if (conflictId) {
      conflictIds.add(conflictId);
    }
  }

  return {
    claimsCreated: createdClaims.length,
    conflictsCreated: conflictIds.size,
  };
}

export async function reconcileEmberMessageSafely(messageId: string, context = 'memory reconciliation') {
  try {
    return await reconcileEmberMessage(messageId);
  } catch (error) {
    console.error(`${context} failed:`, error);
    return {
      claimsCreated: 0,
      conflictsCreated: 0,
    };
  }
}

export async function refreshMemoryReconciliationForImage(imageId: string) {
  await prisma.memoryConflict.deleteMany({
    where: {
      imageId,
    },
  });
  await prisma.memoryClaim.deleteMany({
    where: {
      imageId,
    },
  });

  const messages = await prisma.emberMessage.findMany({
    where: {
      role: 'user',
      content: {
        not: '',
      },
      questionType: {
        not: null,
      },
      session: {
        imageId,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
    },
  });

  let claimsCreated = 0;
  let conflictsCreated = 0;

  for (const message of messages) {
    const result = await reconcileEmberMessageSafely(
      message.id,
      `memory reconciliation refresh for ${imageId}`
    );
    claimsCreated += result.claimsCreated;
    conflictsCreated += result.conflictsCreated;
  }

  const openConflictCount = await prisma.memoryConflict.count({
    where: {
      imageId,
      status: 'open',
    },
  });

  return {
    processedMessages: messages.length,
    claimsCreated,
    conflictsCreated,
    openConflictCount,
  };
}
