import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { resolvePrompt } from '@/lib/control-plane';
import { prisma } from '@/lib/db';
import { PROMPT_REGISTRY } from '@/lib/prompt-registry';
import { groupFromSlug, groupSlug } from '@/lib/admin-prompt-groups';

export const dynamic = 'force-dynamic';

function formatLastSaved(value: string | null): string {
  if (!value) return 'Never saved';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never saved';
  return `Saved ${date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

export default async function AdminPromptGroupPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group: groupParam } = await params;
  const group = groupFromSlug(groupParam);
  if (!group) notFound();

  const definitions = PROMPT_REGISTRY.filter((d) => d.group === group);

  const overrideRows = await prisma.promptOverride.findMany({
    select: { key: true, updatedAt: true },
  });
  const updatedAtByKey = new Map(
    overrideRows.map((row) => [row.key, row.updatedAt.toISOString()])
  );

  const cards = await Promise.all(
    definitions.map(async (def) => {
      const resolution = await resolvePrompt(def.key).catch(() => null);
      return {
        ...def,
        isActive: resolution !== null,
        updatedAt: updatedAtByKey.get(def.key) ?? null,
      };
    })
  );

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-baseline justify-between mb-5">
        <h1 className="text-xl lg:text-2xl font-semibold">{group}</h1>
        <span className="text-xs text-gray-500 tabular-nums">
          {cards.length} {cards.length === 1 ? 'prompt' : 'prompts'}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-5">
        Click a prompt to edit it full-screen. Green dot = a custom body is
        in use; red dot = nothing set, the feature would crash if called.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {cards.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">No prompts in this category.</div>
        ) : (
          cards.map((card, idx) => (
            <Link
              key={card.key}
              href={`/admin/prompts/${groupSlug(group)}/${encodeURIComponent(card.key)}`}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${
                idx > 0 ? 'border-t border-gray-200' : ''
              }`}
            >
              <span
                aria-label={card.isActive ? 'in use' : 'not in use'}
                className={`h-2 w-2 shrink-0 rounded-full ${
                  card.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{card.label}</div>
                <div className="font-mono text-[11px] text-gray-500 truncate">{card.key}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {formatLastSaved(card.updatedAt)}
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-400 shrink-0" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
