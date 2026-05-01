import { notFound } from 'next/navigation';
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

  const [resolution, override] = await Promise.all([
    resolvePrompt(definition.key).catch(() => null),
    prisma.promptOverride.findUnique({
      where: { key: definition.key },
      select: { updatedAt: true },
    }),
  ]);

  return (
    <AdminPromptEditor
      promptKey={definition.key}
      label={definition.label}
      group={group}
      groupHref={`/admin/prompts/${groupSlug(group)}`}
      description={definition.description}
      variables={definition.variables}
      body={resolution?.body || ''}
      isActive={resolution !== null}
      updatedAt={override?.updatedAt.toISOString() ?? null}
    />
  );
}
