'use client';

import { useEffect, useState } from 'react';

export type PromptCardData = {
  key: string;
  label: string;
  group: string;
  description: string;
  variables: string[];
  body: string;
  isActive: boolean;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function PromptCard({ data }: { data: PromptCardData }) {
  const [draft, setDraft] = useState(data.body);
  const [savedBody, setSavedBody] = useState(data.body);
  const [isActive, setIsActive] = useState(data.isActive);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDirty = draft !== savedBody;

  useEffect(() => {
    if (saveState === 'saved') {
      const timer = setTimeout(() => setSaveState('idle'), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [saveState]);

  async function save() {
    if (!isDirty || !draft.trim()) return;
    setSaveState('saving');
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/prompts/${encodeURIComponent(data.key)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: draft }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || `save failed (${response.status})`);
      }
      setSavedBody(draft);
      setIsActive(true);
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      setErrorMessage(error instanceof Error ? error.message : 'save failed');
    }
  }

  return (
    <article
      id={`prompt-${data.key}`}
      className="rounded-lg border border-white/10 bg-white/[0.03] p-5"
    >
      <header className="border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <span
            aria-label={isActive ? 'in use' : 'not in use'}
            className={`h-2 w-2 rounded-full ${
              isActive ? 'bg-emerald-400' : 'bg-rose-400'
            }`}
          />
          <h2 className="text-lg font-semibold text-zinc-100">{data.label}</h2>
        </div>
        <p className="mt-1 font-mono text-xs text-zinc-500">{data.key}</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{data.description}</p>
        {data.variables.length > 0 ? (
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-zinc-500">
            Variables: {data.variables.map((variable) => `{{${variable}}}`).join('  ')}
          </p>
        ) : null}
      </header>

      <textarea
        className="mt-4 block min-h-[200px] w-full rounded-md border border-white/10 bg-black/35 p-4 font-mono text-sm leading-6 text-zinc-100 outline-none focus:border-amber-300/40"
        spellCheck={false}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          if (saveState !== 'idle') setSaveState('idle');
        }}
      />

      <footer className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs text-zinc-400">
          {saveState === 'saving' ? 'saving…' : null}
          {saveState === 'saved' ? <span className="text-emerald-300">saved</span> : null}
          {saveState === 'error' && errorMessage ? (
            <span className="text-rose-300">{errorMessage}</span>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!isDirty || saveState === 'saving' || !draft.trim()}
          onClick={save}
          className="rounded-md bg-amber-400 px-4 py-1.5 text-xs font-semibold text-amber-950 transition-colors can-hover hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-amber-400/30 disabled:text-amber-950/50"
        >
          Save
        </button>
      </footer>
    </article>
  );
}
