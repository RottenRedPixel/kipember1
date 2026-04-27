import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuth } from '@/lib/auth-server';
import { invalidatePromptOverrideCache } from '@/lib/control-plane';
import { prisma } from '@/lib/db';
import { APPROVED_PROMPT_KEYS } from '@/lib/prompt-registry';

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
    create: { key, body },
    update: { body },
  });

  invalidatePromptOverrideCache();

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

  return NextResponse.json({ ok: true });
}
