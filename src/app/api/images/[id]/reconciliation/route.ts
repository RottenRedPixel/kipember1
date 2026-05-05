import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess } from '@/lib/ember';
import { prisma } from '@/lib/db';
import { refreshMemoryReconciliationForImage } from '@/lib/memory-reconciliation';

function safeParseJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function serializeClaim(claim: {
  id: string;
  claimType: string;
  subject: string;
  value: string;
  normalizedValue: string;
  rawText: string | null;
  confidence: number | null;
  evidenceKind: string;
  resolutionMode: string;
  status: string;
  questionType: string | null;
  source: string;
  metadataJson: string | null;
  createdAt: Date;
  emberMessageId?: string | null;
  emberContributorId?: string | null;
  userId?: string | null;
}) {
  return {
    id: claim.id,
    claimType: claim.claimType,
    subject: claim.subject,
    value: claim.value,
    normalizedValue: claim.normalizedValue,
    rawText: claim.rawText,
    confidence: claim.confidence,
    evidenceKind: claim.evidenceKind,
    resolutionMode: claim.resolutionMode,
    status: claim.status,
    questionType: claim.questionType,
    source: claim.source,
    emberMessageId: claim.emberMessageId ?? null,
    contributorId: claim.emberContributorId ?? null,
    userId: claim.userId ?? null,
    metadata: safeParseJson(claim.metadataJson),
    createdAt: claim.createdAt.toISOString(),
  };
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

    const [claims, conflicts] = await Promise.all([
      prisma.memoryClaim.findMany({
        where: {
          imageId: id,
        },
        orderBy: [
          { claimType: 'asc' },
          { subject: 'asc' },
          { createdAt: 'asc' },
        ],
      }),
      prisma.memoryConflict.findMany({
        where: {
          imageId: id,
        },
        orderBy: [
          { status: 'asc' },
          { updatedAt: 'desc' },
        ],
        include: {
          claims: {
            include: {
              claim: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      claims: claims.map(serializeClaim),
      conflicts: conflicts.map((conflict) => ({
        id: conflict.id,
        claimType: conflict.claimType,
        subject: conflict.subject,
        summary: conflict.summary,
        status: conflict.status,
        resolutionMode: conflict.resolutionMode,
        resolutionValue: conflict.resolutionValue,
        resolutionNote: conflict.resolutionNote,
        outreachQuestion: conflict.outreachQuestion,
        confidence: conflict.confidence,
        metadata: safeParseJson(conflict.metadataJson),
        resolvedAt: conflict.resolvedAt?.toISOString() ?? null,
        createdAt: conflict.createdAt.toISOString(),
        updatedAt: conflict.updatedAt.toISOString(),
        claims: conflict.claims.map((item) => ({
          stance: item.stance,
          claim: serializeClaim(item.claim),
        })),
      })),
    });
  } catch (error) {
    console.error('Memory reconciliation load error:', error);
    return NextResponse.json(
      { error: 'Failed to load memory reconciliation state' },
      { status: 500 }
    );
  }
}

export async function POST(
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

    const result = await refreshMemoryReconciliationForImage(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Memory reconciliation refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh memory reconciliation state' },
      { status: 500 }
    );
  }
}
