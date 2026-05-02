import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuth } from '@/lib/auth-server';
import { isAdmin } from '@/lib/admin-access';
import { renderTemplate } from '@/lib/control-plane';
import { loadPromptVariables } from '@/lib/ember-chat-reply';
import { getPromptDefinition } from '@/lib/prompt-registry';
import { isPreviewSupportedForKey } from '@/lib/admin-prompt-preview';
import { prisma } from '@/lib/db';
import { getUserDisplayName } from '@/lib/user-name';

/**
 * POST /api/admin/prompts/preview
 *
 * Renders a prompt's body against a real ember's variables and returns
 * the resulting system-prompt string — i.e. exactly what Claude would
 * see for that ember on a typical chat reply. Used by the admin
 * editor's "Preview with real ember data" panel.
 *
 * Body: { promptKey: string, emberId: string, bodyOverride?: string }
 *
 * If `bodyOverride` is provided, it's rendered instead of the saved
 * body — that lets the admin preview unsaved edits.
 */
export async function POST(request: NextRequest) {
  const auth = await getCurrentAuth();
  if (!auth || !isAdmin(auth.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as
    | { promptKey?: string; emberId?: string; bodyOverride?: string }
    | null;

  const promptKey = typeof payload?.promptKey === 'string' ? payload.promptKey : '';
  const emberId = typeof payload?.emberId === 'string' ? payload.emberId : '';
  const bodyOverride = typeof payload?.bodyOverride === 'string' ? payload.bodyOverride : null;

  const definition = getPromptDefinition(promptKey);
  if (!definition) {
    return NextResponse.json({ error: 'Unknown prompt key' }, { status: 400 });
  }
  if (!isPreviewSupportedForKey(promptKey)) {
    return NextResponse.json(
      { error: 'Preview not yet supported for this prompt type.' },
      { status: 400 }
    );
  }
  if (!emberId) {
    return NextResponse.json({ error: 'emberId is required' }, { status: 400 });
  }

  const ember = await prisma.image.findFirst({
    where: { id: emberId, ownerId: auth.user.id },
    select: { id: true, ownerId: true },
  });
  if (!ember) {
    return NextResponse.json(
      { error: 'Ember not found among your owned embers.' },
      { status: 404 }
    );
  }

  // Build the variable bag the chat/voice surfaces would inject. Per-call
  // values that aren't on the ember (role, trigger, transcript) are
  // sampled with realistic defaults so the preview is concrete.
  const owner = await prisma.user.findUnique({
    where: { id: ember.ownerId },
    select: { firstName: true, lastName: true, email: true },
  });
  const baseVars = await loadPromptVariables(emberId);

  const sampledVars: Record<string, string> = {
    ...baseVars,
    capturedAt: typeof baseVars.capturedAt === 'string' ? baseVars.capturedAt : '',
    role: 'owner',
    trigger: 'message',
    userFirstName: owner?.firstName ?? getUserDisplayName(owner) ?? '',
    isFirstEmber: 'false',
    transcript: '(sample transcript: "Tell me about the day this was taken.")',
  };

  const body = bodyOverride ?? '';
  if (!body.trim()) {
    return NextResponse.json({ body: '(prompt body is empty)' });
  }

  const rendered = renderTemplate(body, sampledVars);
  return NextResponse.json({ body: rendered });
}
