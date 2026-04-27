import { unstable_noStore as noStore } from 'next/cache';
import {
  RUNTIME_PROMPT_DEFINITIONS,
  getControlPlaneSnapshot,
} from '@/lib/control-plane';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'unpublished';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default async function PromptsPage() {
  noStore();
  const snapshot = await getControlPlaneSnapshot();
  const generatedAt = snapshot?.generatedAt ? formatDate(snapshot.generatedAt) : 'not connected';

  return (
    <main className="min-h-screen bg-[#101313] px-6 py-8 text-zinc-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="border-b border-white/10 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
            Temporary prompt view
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Active Prompts</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Read-only runtime view. Last control-plane snapshot: {generatedAt}.
          </p>
        </header>

        <section className="grid gap-4">
          {RUNTIME_PROMPT_DEFINITIONS.map((definition) => {
            const prompt = snapshot?.prompts?.[definition.key];
            const body = prompt?.body?.trim();

            return (
              <article
                className="rounded-lg border border-white/10 bg-white/[0.03] p-5"
                key={definition.key}
              >
                <div className="flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{definition.label}</h2>
                    <p className="mt-1 font-mono text-xs text-zinc-400">{definition.key}</p>
                  </div>
                  <div className="text-left text-xs text-zinc-400 sm:text-right">
                    <p>v{prompt?.versionNumber ?? '-'}</p>
                    <p>{formatDate(prompt?.publishedAt)}</p>
                  </div>
                </div>

                {body ? (
                  <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md bg-black/35 p-4 font-mono text-sm leading-6 text-zinc-100">
                    {body}
                  </pre>
                ) : (
                  <div className="mt-4 rounded-md border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                    prompt removed
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
