import { notFound } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import { resolvePrompt } from '@/lib/control-plane';
import { prisma } from '@/lib/db';
import { getPromptDefinition } from '@/lib/prompt-registry';
import { groupFromSlug, groupSlug } from '@/lib/admin-prompt-groups';
import AdminPromptEditor from '@/components/admin/AdminPromptEditor';

export const dynamic = 'force-dynamic';

export default async function AdminPromptEditorPage({
  params,
}: {
  params: Promise<{ group: string; key: string }>;
}) {
  const { group: groupParam, key: keyParam } = await params;
  const group = groupFromSlug(groupParam);
  if (!group) notFound();

  const promptKey = decodeURIComponent(keyParam);
  const definition = getPromptDefinition(promptKey);
  if (!definition || definition.group !== group) notFound();

  const [auth, resolution, override] = await Promise.all([
    getCurrentAuth(),
    resolvePrompt(definition.key).catch(() => null),
    prisma.promptOverride.findUnique({
      where: { key: definition.key },
      select: { updatedAt: true, updatedBy: true },
    }),
  ]);
  const currentAdminName =
    [auth?.user?.firstName, auth?.user?.lastName].filter(Boolean).join(' ').trim() ||
    auth?.user?.email ||
    'You';

  // The editor is recorded as an email. Resolve to a display name (first +
  // last). If the admin who edited it has been deleted or the override is old
  // enough to predate this column, fall back to the email or null.
  let updatedByName: string | null = null;
  if (override?.updatedBy) {
    const editor = await prisma.user.findUnique({
      where: { email: override.updatedBy },
      select: { firstName: true, lastName: true },
    });
    const fullName = [editor?.firstName, editor?.lastName].filter(Boolean).join(' ').trim();
    updatedByName = fullName || override.updatedBy;
  }

  return (
    <AdminPromptEditor
      promptKey={definition.key}
      label={definition.label}
      group={group}
      groupHref={`/admin/prompts/${groupSlug(group)}`}
      description={definition.description}
      variables={definition.variables}
      whatItDoes={definition.whatItDoes}
      whenItFires={definition.whenItFires}
      affects={definition.affects}
      body={resolution?.body || ''}
      isActive={resolution !== null}
      updatedAt={override?.updatedAt.toISOString() ?? null}
      updatedByName={updatedByName}
      currentAdminName={currentAdminName}
    />
  );
}
