import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess } from '@/lib/ember';
import { prisma } from '@/lib/db';
import { refreshMemoryReconciliationForImage } from '@/lib/memory-reconciliation';
import { parseCallTranscriptSegments } from '@/lib/ember-clips';
import { getUploadUrl } from '@/lib/uploads';

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

// A "claim source" is the actual user-generated artifact that produced a
// claim: a typed chat message, a recorded voice message, or a call turn.
// Never the LLM's paraphrase. The UI renders one of these per claim so the
// reader can verify what was really said.
export type ClaimSource =
  | { kind: 'chat'; text: string; messageId: string }
  | { kind: 'sms'; text: string; messageId: string }
  | { kind: 'voice'; text: string; messageId: string; audioUrl: string | null }
  | { kind: 'call'; text: string; voiceCallId: string; recordingUrl: string | null; startMs: number | null; endMs: number | null };

type ClaimWithRelations = {
  emberMessage: {
    id: string;
    content: string;
    source: string;
    audioFilename: string | null;
    session: { sessionType: string } | null;
  } | null;
  sourceSession: {
    id: string;
    sessionType: string;
    voiceCalls: Array<{
      id: string;
      recordingUrl: string | null;
      transcriptObjectJson: string | null;
      transcript: string | null;
      emberContributor: { user: { firstName: string | null; lastName: string | null; email: string | null } } | null;
    }>;
  } | null;
};

function normalizeForVerbatimSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildClaimSources(
  claim: ClaimWithRelations & { rawText: string | null; value: string },
): ClaimSource[] {
  // 1) Chat / voice / sms — direct emberMessage linkage
  const msg = claim.emberMessage;
  if (msg) {
    const sessionType = msg.session?.sessionType ?? 'chat';
    const source = msg.source;

    if (source === 'sms') {
      return [{ kind: 'sms', text: msg.content, messageId: msg.id }];
    }
    if (sessionType === 'voice' || source === 'voice') {
      return [{
        kind: 'voice',
        text: msg.content,
        messageId: msg.id,
        audioUrl: msg.audioFilename ? getUploadUrl(msg.audioFilename) : null,
      }];
    }
    // Default: chat (web)
    return [{ kind: 'chat', text: msg.content, messageId: msg.id }];
  }

  // 2) Call — claim has sourceSessionId but no emberMessageId (call extractor
  // currently runs on the whole concatenated transcript). Find the single
  // segment in the call whose verbatim content contains claim.rawText. If no
  // verbatim match → no source row (we will NOT invent one).
  const session = claim.sourceSession;
  if (session?.sessionType === 'call' && session.voiceCalls.length > 0) {
    const call = session.voiceCalls[0];
    // rawText is null on call claims (call extractor runs on concatenated
    // transcript without per-turn linkage). Fall back to value — but we still
    // demand it appear as a literal substring in an actual user turn, so we
    // are never showing words that weren't spoken.
    const search = (claim.rawText || claim.value || '').trim();
    if (!search) return [];

    const contributorName = (() => {
      const user = call.emberContributor?.user;
      const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
      return fullName || user?.email?.trim() || 'Contributor';
    })();

    const segments = parseCallTranscriptSegments({
      transcript: call.transcript,
      transcriptObjectJson: call.transcriptObjectJson,
      contributorName,
    });
    const searchNorm = normalizeForVerbatimSearch(search);
    if (!searchNorm) return [];

    const matched = segments.find(
      (segment) =>
        segment.role === 'user' &&
        normalizeForVerbatimSearch(segment.content).includes(searchNorm),
    );

    if (!matched) return [];

    return [{
      kind: 'call',
      text: matched.content,
      voiceCallId: call.id,
      recordingUrl: call.recordingUrl,
      startMs: matched.startMs,
      endMs: matched.endMs,
    }];
  }

  return [];
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
} & Partial<ClaimWithRelations>) {
  const sources = buildClaimSources({
    rawText: claim.rawText,
    value: claim.value,
    emberMessage: claim.emberMessage ?? null,
    sourceSession: claim.sourceSession ?? null,
  });
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
    sources,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Accept session auth (owner/contributor) OR token-based guest access.
    const tokenParam = request.nextUrl.searchParams.get('token');
    if (tokenParam) {
      const [contributor, emberByShare] = await Promise.all([
        prisma.emberContributor.findUnique({ where: { token: tokenParam }, select: { emberId: true } }),
        prisma.ember.findUnique({ where: { shareToken: tokenParam }, select: { id: true } }),
      ]);
      const allowed = contributor?.emberId === id || emberByShare?.id === id;
      if (!allowed) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    } else {
      const auth = await requireApiUser();
      if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const ember = await ensureEmberOwnerAccess(auth.user.id, id);
      if (!ember) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const [claims, conflicts] = await Promise.all([
      prisma.memoryClaim.findMany({
        where: {
          emberId: id,
        },
        orderBy: [
          { claimType: 'asc' },
          { subject: 'asc' },
          { createdAt: 'asc' },
        ],
        include: {
          emberMessage: {
            select: {
              id: true,
              content: true,
              source: true,
              audioFilename: true,
              session: { select: { sessionType: true } },
            },
          },
          sourceSession: {
            select: {
              id: true,
              sessionType: true,
              voiceCalls: {
                select: {
                  id: true,
                  recordingUrl: true,
                  transcriptObjectJson: true,
                  transcript: true,
                  emberContributor: {
                    select: {
                      user: { select: { firstName: true, lastName: true, email: true } },
                    },
                  },
                },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      }),
      prisma.memoryConflict.findMany({
        where: {
          emberId: id,
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
    const ember = await ensureEmberOwnerAccess(auth.user.id, id);

    if (!ember) {
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
