import { redirect } from 'next/navigation';
import { PROMPT_GROUPS } from '@/lib/prompt-registry';
import { groupSlug } from '@/lib/admin-prompt-groups';

export default function AdminPromptsIndex() {
  redirect(`/admin/prompts/${groupSlug(PROMPT_GROUPS[0])}`);
}
