import { PROMPT_GROUPS, type PromptGroup } from '@/lib/prompt-registry';

/** "Image Analysis" -> "image-analysis" */
export function groupSlug(group: PromptGroup): string {
  return group.toLowerCase().replace(/\s+/g, '-');
}

/** "image-analysis" -> "Image Analysis", or null if unknown */
export function groupFromSlug(slug: string): PromptGroup | null {
  return PROMPT_GROUPS.find((g) => groupSlug(g) === slug) ?? null;
}
