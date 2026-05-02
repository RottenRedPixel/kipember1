import { notFound, redirect } from 'next/navigation';
import { PROMPT_REGISTRY } from '@/lib/prompt-registry';
import { groupFromSlug, groupSlug } from '@/lib/admin-prompt-groups';

export const dynamic = 'force-dynamic';

// The group landing page used to show all prompts in the group as a list.
// We removed that view — clicking a group header in the sidebar is no longer
// a destination. This route still exists so old URLs (or direct typing) land
// somewhere useful: the first prompt's editor in that group.
export default async function AdminPromptGroupPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group: groupParam } = await params;
  const group = groupFromSlug(groupParam);
  if (!group) notFound();

  const firstPrompt = PROMPT_REGISTRY.find((p) => p.group === group);
  if (!firstPrompt) notFound();

  redirect(`/admin/prompts/${groupSlug(group)}/${encodeURIComponent(firstPrompt.key)}`);
}
