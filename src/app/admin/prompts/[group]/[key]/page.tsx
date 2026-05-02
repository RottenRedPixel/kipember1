import { notFound } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import { resolvePrompt } from '@/lib/control-plane';
import { prisma } from '@/lib/db';
import { getPromptDefinition } from '@/lib/prompt-registry';
import { groupFromSlug, groupSlug } from '@/lib/admin-prompt-groups';
import { getEmberTitle } from '@/lib/ember-title';
import { isPreviewSupportedForKey } from '@/lib/admin-prompt-preview';
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

  const auth = await getCurrentAuth();
  const [resolution, override, embers] = await Promise.all([
    resolvePrompt(definition.key).catch(() => null),
    prisma.promptOverride.findUnique({
      where: { key: definition.key },
      select: { updatedAt: true },
    }),
    auth
      ? prisma.image.findMany({
          where: { ownerId: auth.user.id },
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: { id: true, title: true, originalName: true },
        })
      : Promise.resolve([]),
  ]);

  const previewEmbers = embers.map((e) => ({
    id: e.id,
    title: getEmberTitle(e),
  }));

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
      previewEmbers={previewEmbers}
      previewSupported={isPreviewSupportedForKey(definition.key)}
    />
  );
}
