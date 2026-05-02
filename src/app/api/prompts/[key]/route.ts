import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuth } from '@/lib/auth-server';
import { invalidatePromptOverrideCache } from '@/lib/control-plane';
import { prisma } from '@/lib/db';
import { APPROVED_PROMPT_KEYS } from '@/lib/prompt-registry';
import { RETELL_PROMPT_KEYS, syncRetellAgent } from '@/lib/retell-sync';

function syncRetellInBackground(triggerKey: string) {
  if (!RETELL_PROMPT_KEYS.has(triggerKey)) return;
  syncRetellAgent()
    .then((result) => {
      console.log(
        `Retell sync triggered by ${triggerKey} → agent v${result.agentVersion}, flow v${result.conversationFlowVersion}`
      );
    })
    .catch((error) => {
      console.error(`Retell sync after ${triggerKey} update failed:`, error);
    });
}

type RouteContext = {
  params: Promise<{ key: string }>;
};

async function requireAuth() {
  const auth = await getCurrentAuth();
  if (!auth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return auth;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { key } = await context.params;
  if (!APPROVED_PROMPT_KEYS.has(key)) {
    return NextResponse.json({ error: 'unknown prompt key' }, { status: 404 });
  }

  const row = await prisma.promptOverride.findUnique({
    where: { key },
    select: { key: true, body: true, updatedAt: true, updatedBy: true },
  });

  if (!row) {
    return NextResponse.json({ key, body: null, updatedAt: null, updatedBy: null });
  }

  return NextResponse.json({
    key: row.key,
    body: row.body,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy ?? null,
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { key } = await context.params;
  if (!APPROVED_PROMPT_KEYS.has(key)) {
    return NextResponse.json({ error: 'unknown prompt key' }, { status: 404 });
  }

  let payload: { body?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (typeof payload.body !== 'string') {
    return NextResponse.json({ error: 'body must be a string' }, { status: 400 });
  }

  const body = payload.body.trim();
  if (!body) {
    return NextResponse.json({ error: 'body cannot be empty' }, { status: 400 });
  }

  const saved = await prisma.promptOverride.upsert({
    where: { key },
    create: { key, body, updatedBy: authResult.user.email },
    update: { body, updatedBy: authResult.user.email },
  });

  invalidatePromptOverrideCache();
  syncRetellInBackground(key);

  return NextResponse.json({
    key: saved.key,
    body: saved.body,
    updatedAt: saved.updatedAt.toISOString(),
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { key } = await context.params;
  if (!APPROVED_PROMPT_KEYS.has(key)) {
    return NextResponse.json({ error: 'unknown prompt key' }, { status: 404 });
  }

  await prisma.promptOverride
    .delete({ where: { key } })
    .catch(() => undefined);

  invalidatePromptOverrideCache();
  syncRetellInBackground(key);

  return NextResponse.json({ ok: true });
}
