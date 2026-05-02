'use client';

import Link from 'next/link';
import { ArrowLeft, Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export type AdminPromptEditorProps = {
  promptKey: string;
  label: string;
  group: string;
  groupHref: string;
  description: string;
  variables: string[];
  whatItDoes: string;
  whenItFires: string[];
  affects: Array<{ label: string; on: boolean }>;
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
      </div>

      {/* Narrative panels — what / when / affects */}
      <div className="bg-gray-50 px-4 lg:px-8 py-5 grid grid-cols-1 lg:grid-cols-3 gap-3 border-b border-gray-200">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            What this prompt does
          </div>
          <p className="text-sm leading-relaxed text-gray-700">{props.whatItDoes}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            When it fires
          </div>
          <ul className="text-sm leading-relaxed text-gray-700 space-y-1.5">
            {props.whenItFires.map((trigger, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gray-400 select-none">•</span>
                <span>{trigger}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Editing this affects
          </div>
          <ul className="text-sm leading-relaxed space-y-1.5">
            {props.affects.map((row, i) => (
              <li key={i} className="flex gap-2">
                {row.on ? (
                  <Check size={14} strokeWidth={2.5} className="text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <X size={14} strokeWidth={2.5} className="text-gray-300 mt-0.5 shrink-0" />
                )}
                <span className={row.on ? 'text-gray-800' : 'text-gray-500'}>{row.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Read-only registry-defined description + variable list */}
      <div className="bg-white px-4 lg:px-8 py-3 border-b border-gray-200 text-xs text-gray-500 space-y-1">
        <p>{props.description}</p>
        {props.variables.length > 0 ? (
          <p className="font-mono text-[11px] text-gray-500">
            Variables Ember fills in: {props.variables.map((v) => `{{${v}}}`).join('  ')}
          </p>
        ) : (
          <p className="font-mono text-[11px] text-gray-500">
            (No template variables — body is sent to the model as-is.)
          </p>
        )}
      </div>

      {/* Editor — full-pane textarea */}
      <div className="bg-white px-4 lg:px-8 pt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Prompt body — editable
      </div>
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
