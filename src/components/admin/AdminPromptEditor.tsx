'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

export type AdminPromptEditorProps = {
  promptKey: string;
  label: string;
  group: string;
  groupHref: string;
  description: string;
  variables: string[];
  body: string;
  isActive: boolean;
  updatedAt: string | null;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function formatLastSaved(value: string | null): string {
  if (!value) return 'Never saved';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never saved';
  return `Last saved ${date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

export default function AdminPromptEditor(props: AdminPromptEditorProps) {
  const [draft, setDraft] = useState(props.body);
  const [savedBody, setSavedBody] = useState(props.body);
  const [isActive, setIsActive] = useState(props.isActive);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(props.updatedAt);

  const isDirty = draft !== savedBody;

  useEffect(() => {
    if (saveState === 'saved') {
      const t = setTimeout(() => setSaveState('idle'), 1500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [saveState]);

  async function save() {
    if (!isDirty || !draft.trim()) return;
    setSaveState('saving');
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/prompts/${encodeURIComponent(props.promptKey)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: draft }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || `save failed (${response.status})`);
      }
      const payload = (await response.json().catch(() => null)) as
        | { updatedAt?: string }
        | null;
      setSavedBody(draft);
      setIsActive(true);
      setSaveState('saved');
      setUpdatedAt(payload?.updatedAt ?? new Date().toISOString());
    } catch (error) {
      setSaveState('error');
      setErrorMessage(error instanceof Error ? error.message : 'save failed');
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] lg:min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4">
        <Link
          href={props.groupHref}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeft size={12} />
          {props.group}
        </Link>
        <div className="flex items-start gap-3">
          <span
            aria-label={isActive ? 'in use' : 'not in use'}
            className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
              isActive ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg lg:text-xl font-semibold text-gray-900">{props.label}</h1>
            <p className="font-mono text-xs text-gray-500 mt-0.5 break-all">{props.promptKey}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatLastSaved(updatedAt)}</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-gray-600 mt-3">{props.description}</p>
        {props.variables.length > 0 ? (
          <p className="font-mono text-[11px] leading-relaxed text-gray-500 mt-2">
            Variables: {props.variables.map((v) => `{{${v}}}`).join('  ')}
          </p>
        ) : null}
      </div>

      {/* Editor — full-pane textarea */}
      <textarea
        className="flex-1 block w-full bg-gray-50 px-4 lg:px-8 py-4 font-mono text-sm leading-6 text-gray-900 outline-none border-0 resize-none min-h-[400px]"
        spellCheck={false}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          if (saveState !== 'idle') setSaveState('idle');
        }}
      />

      {/* Save bar — sticky at bottom */}
      <div className="bg-white border-t border-gray-200 px-4 lg:px-8 py-3 flex items-center justify-between gap-3">
        <div className="text-xs">
          {saveState === 'saving' ? <span className="text-gray-500">saving…</span> : null}
          {saveState === 'saved' ? <span className="text-emerald-600 font-medium">saved</span> : null}
          {saveState === 'error' && errorMessage ? (
            <span className="text-rose-600">{errorMessage}</span>
          ) : null}
          {saveState === 'idle' && isDirty ? (
            <span className="text-amber-600">unsaved changes</span>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!isDirty || saveState === 'saving' || !draft.trim()}
          onClick={save}
          className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          Save
        </button>
      </div>
    </div>
  );
}
