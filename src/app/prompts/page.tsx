import { unstable_noStore as noStore } from 'next/cache';
import { resolvePrompt } from '@/lib/control-plane';
import {
  PROMPT_GROUPS,
  PROMPT_REGISTRY,
  type PromptDefinition,
  type PromptGroup,
} from '@/lib/prompt-registry';
import { PromptCard, type PromptCardData } from './PromptEditor';

export const dynamic = 'force-dynamic';

async function buildCardData(definition: PromptDefinition): Promise<PromptCardData> {
  const resolution = await resolvePrompt(definition.key).catch(() => null);

  return {
    key: definition.key,
    label: definition.label,
    group: definition.group,
    description: definition.description,
    variables: definition.variables,
    body: resolution?.body || '',
    isActive: resolution !== null,
  };
}

export default async function PromptsPage() {
  noStore();

  const cards = await Promise.all(PROMPT_REGISTRY.map(buildCardData));
  const cardsByGroup = new Map<PromptGroup, PromptCardData[]>();
  for (const group of PROMPT_GROUPS) {
    cardsByGroup.set(group, []);
  }
  for (const card of cards) {
    cardsByGroup.get(card.group as PromptGroup)?.push(card);
  }

  return (
    <main className="min-h-screen bg-[#101313] px-6 py-8 text-zinc-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="border-b border-white/10 pb-5">
          <h1 className="text-3xl font-semibold tracking-tight">Prompts</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Edit a prompt and click Save. The next request uses your version.
            Green dot means the prompt is in use; red means nothing is set and
            the feature would crash if called.
          </p>
        </header>

        <div className="flex flex-col gap-10">
          {PROMPT_GROUPS.map((group) => {
            const groupCards = cardsByGroup.get(group) ?? [];
            if (groupCards.length === 0) return null;
            return (
              <section key={group} className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  {group}
                </h2>
                {groupCards.map((card) => (
                  <PromptCard key={card.key} data={card} />
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
