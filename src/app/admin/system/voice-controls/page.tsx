'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Check, Pencil, X } from 'lucide-react';

type VoiceRow = {
  id: string;
  name: string;
  accent: string;
  gender: 'female' | 'male';
  elevenLabsId: string;
  retellId: string;
  userCount: number;
};

type ApiResponse = {
  voices: VoiceRow[];
  totalUsers: number;
};

type EditState = {
  voiceId: string;
  field: 'elevenLabsId' | 'retellId';
  value: string;
} | null;

export default function AdminVoiceControlsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<EditState>(null);
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/system/voice-controls', { cache: 'no-store' });
      if (!res.ok) { setError(`Request failed (${res.status})`); return; }
      setData(await res.json() as ApiResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startEdit = (voiceId: string, field: 'elevenLabsId' | 'retellId', current: string) => {
    setEdit({ voiceId, field, value: current });
    setSavedKey('');
  };

  const cancelEdit = () => setEdit(null);

  const commitEdit = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/system/voice-controls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edit),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        setError(j.error ?? `Save failed (${res.status})`);
        return;
      }
      const key = `${edit.voiceId}-${edit.field}`;
      // Update local state
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          voices: prev.voices.map((v) =>
            v.id === edit.voiceId ? { ...v, [edit.field]: edit.value } : v
          ),
        };
      });
      setEdit(null);
      setSavedKey(key);
      setTimeout(() => setSavedKey(''), 2000);
    } finally {
      setSaving(false);
    }
  };

  const female = data?.voices.filter((v) => v.gender === 'female') ?? [];
  const male = data?.voices.filter((v) => v.gender === 'male') ?? [];

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Voice Controls</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Catalog of 6 voices used across chat TTS, story playback, and Retell calls.
            {data ? ` ${data.totalUsers} users total.` : ''}
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md px-3 py-1.5 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="text-sm text-gray-400">Loading…</div>
      )}

      {data && (
        <div className="space-y-6">
          {[{ label: 'Female', rows: female }, { label: 'Male', rows: male }].map(({ label, rows }) => (
            <div key={label}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {label}
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 font-medium">
                      <th className="px-4 py-2.5 w-24">Voice</th>
                      <th className="px-4 py-2.5">ElevenLabs ID</th>
                      <th className="px-4 py-2.5">Retell ID</th>
                      <th className="px-4 py-2.5 w-20 text-right">Users</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((v) => (
                      <tr key={v.id} className="bg-white">
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900">{v.name}</span>
                          <span className="block text-xs text-gray-400">{v.accent}</span>
                        </td>
                        <td className="px-4 py-3">
                          <IdCell
                            voiceId={v.id}
                            field="elevenLabsId"
                            value={v.elevenLabsId}
                            edit={edit}
                            saving={saving}
                            savedKey={savedKey}
                            onEdit={startEdit}
                            onCancel={cancelEdit}
                            onCommit={commitEdit}
                            onEditChange={(val) => setEdit((e) => e ? { ...e, value: val } : e)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <IdCell
                            voiceId={v.id}
                            field="retellId"
                            value={v.retellId}
                            edit={edit}
                            saving={saving}
                            savedKey={savedKey}
                            onEdit={startEdit}
                            onCancel={cancelEdit}
                            onCommit={commitEdit}
                            onEditChange={(val) => setEdit((e) => e ? { ...e, value: val } : e)}
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {v.userCount > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="font-medium text-gray-900">{v.userCount}</span>
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <p className="text-xs text-gray-400">
            Changes to ElevenLabs/Retell IDs take effect immediately for new calls but are
            in-memory only — they reset on server restart. A persistent override table is
            planned for a future admin update.
          </p>
        </div>
      )}
    </div>
  );
}

function IdCell({
  voiceId, field, value, edit, saving, savedKey,
  onEdit, onCancel, onCommit, onEditChange,
}: {
  voiceId: string;
  field: 'elevenLabsId' | 'retellId';
  value: string;
  edit: EditState;
  saving: boolean;
  savedKey: string;
  onEdit: (v: string, f: 'elevenLabsId' | 'retellId', cur: string) => void;
  onCancel: () => void;
  onCommit: () => void;
  onEditChange: (val: string) => void;
}) {
  const isEditing = edit?.voiceId === voiceId && edit?.field === field;
  const key = `${voiceId}-${field}`;
  const justSaved = savedKey === key;

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={edit.value}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void onCommit();
            if (e.key === 'Escape') onCancel();
          }}
          className="font-mono text-xs border border-blue-400 rounded px-2 py-1 w-48 outline-none ring-1 ring-blue-300"
        />
        <button
          onClick={() => void onCommit()}
          disabled={saving}
          className="text-green-600 hover:text-green-700 disabled:opacity-40"
        >
          <Check size={14} />
        </button>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <span className="font-mono text-xs text-gray-600">{value}</span>
      {justSaved ? (
        <Check size={12} className="text-green-500 flex-shrink-0" />
      ) : (
        <button
          onClick={() => onEdit(voiceId, field, value)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-700"
        >
          <Pencil size={12} />
        </button>
      )}
    </div>
  );
}
