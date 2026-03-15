'use client';

import { useMemo, useState } from 'react';

type Tag = {
  id: string;
  label: string;
  email: string | null;
  phoneNumber: string | null;
  leftPct: number | null;
  topPct: number | null;
  widthPct: number | null;
  heightPct: number | null;
  userId: string | null;
  contributorId: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
  } | null;
  contributor?: {
    id: string;
    name: string | null;
    email: string | null;
    phoneNumber: string | null;
    inviteSent: boolean;
  } | null;
};

type PersonOption = {
  id: string;
  label: string;
  email: string;
  phoneNumber: string;
  source: 'friend' | 'contributor';
};

type TagEditorState = {
  tagId: string;
  label: string;
  email: string;
  phoneNumber: string;
};

function tagHasPhoneNumber(tag: Tag): boolean {
  return Boolean(tag.phoneNumber || tag.user?.phoneNumber || tag.contributor?.phoneNumber);
}

function tagCanInvite(tag: Tag): boolean {
  return Boolean(tag.userId || tag.contributorId || tag.email || tag.phoneNumber || tag.user?.email);
}

export default function TagManager({
  imageId,
  tags,
  contributors,
  friends,
  canManage,
  onUpdate,
}: {
  imageId: string;
  tags: Tag[];
  contributors: Array<{
    id: string;
    name: string | null;
    email: string | null;
    phoneNumber: string | null;
    userId: string | null;
  }>;
  friends: Array<{ id: string; name: string | null; email: string; phoneNumber: string | null }>;
  canManage: boolean;
  onUpdate: () => void;
}) {
  const [manualLabel, setManualLabel] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhoneNumber, setManualPhoneNumber] = useState('');
  const [editor, setEditor] = useState<TagEditorState | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyTagId, setBusyTagId] = useState<string | null>(null);

  const quickOptions = useMemo<PersonOption[]>(() => {
    const linkedRecords = new Set(
      tags.flatMap((tag) => [
        tag.userId ? `user:${tag.userId}` : '',
        tag.contributorId ? `contributor:${tag.contributorId}` : '',
      ])
    );

    return [
      ...contributors
        .filter((contributor) => !linkedRecords.has(`contributor:${contributor.id}`))
        .map((contributor) => ({
          id: contributor.id,
          label: contributor.name || contributor.email || 'Unnamed contributor',
          email: contributor.email || '',
          phoneNumber: contributor.phoneNumber || '',
          source: 'contributor' as const,
        })),
      ...friends
        .filter((friend) => !linkedRecords.has(`user:${friend.id}`))
        .map((friend) => ({
          id: friend.id,
          label: friend.name || friend.email,
          email: friend.email,
          phoneNumber: friend.phoneNumber || '',
          source: 'friend' as const,
        })),
    ].slice(0, 10);
  }, [contributors, friends, tags]);

  const createTag = async (body: Record<string, string | null>) => {
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/images/${imageId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create tag');
      }

      setManualLabel('');
      setManualEmail('');
      setManualPhoneNumber('');
      setNotice('Tag added.');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    } finally {
      setSubmitting(false);
    }
  };

  const saveTag = async () => {
    if (!editor) {
      return;
    }

    setBusyTagId(editor.tagId);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/images/${imageId}/tags/${editor.tagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: editor.label.trim(),
          email: editor.email.trim() || null,
          phoneNumber: editor.phoneNumber.trim() || null,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update tag');
      }

      setEditor(null);
      setNotice('Tag updated.');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tag');
    } finally {
      setBusyTagId(null);
    }
  };

  const inviteTag = async (tag: Tag) => {
    setBusyTagId(tag.id);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/images/${imageId}/tags/${tag.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sendText: tagHasPhoneNumber(tag),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to invite tagged person');
      }

      setNotice(payload.textSent ? 'Text invite sent.' : 'Contributor created from tag.');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite tagged person');
    } finally {
      setBusyTagId(null);
    }
  };

  const removeTag = async (tagId: string) => {
    setBusyTagId(tagId);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/images/${imageId}/tags/${tagId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Failed to remove tag');
      }

      setNotice('Tag removed.');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove tag');
    } finally {
      setBusyTagId(null);
    }
  };

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-950">Tagged people</h2>
        <p className="mt-2 text-sm text-slate-600">
          Review tagged faces, add contact info, and turn tags into contributor invites.
        </p>
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-slate-500">No one has been tagged yet.</p>
      ) : (
        <div className="grid gap-3">
          {tags.map((tag) => {
            const editing = editor?.tagId === tag.id;
            const canRunInviteAction = tagHasPhoneNumber(tag) || !tag.contributorId;
            const inviteLabel = tagHasPhoneNumber(tag)
              ? tag.contributor?.inviteSent
                ? 'Resend text'
                : 'Text invite'
              : tag.contributorId
                ? 'Linked contributor'
                : 'Create contributor';

            return (
              <div
                key={tag.id}
                className="rounded-[1.6rem] border border-slate-200 bg-slate-50 px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-950">{tag.label}</h3>
                      {tag.leftPct !== null && tag.topPct !== null && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                          Pinned on photo
                        </span>
                      )}
                      {tag.userId && (
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                          Linked account
                        </span>
                      )}
                      {tag.contributorId && (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                          Contributor
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-slate-600">
                      {(tag.email || tag.user?.email) && <div>Email: {tag.email || tag.user?.email}</div>}
                      {(tag.phoneNumber || tag.user?.phoneNumber || tag.contributor?.phoneNumber) && (
                        <div>
                          Phone:{' '}
                          {tag.phoneNumber || tag.user?.phoneNumber || tag.contributor?.phoneNumber}
                        </div>
                      )}
                      {tag.contributor?.inviteSent && (
                        <div className="font-medium text-emerald-700">Text invite already sent</div>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      {tagCanInvite(tag) && canRunInviteAction && (
                        <button
                          type="button"
                          disabled={busyTagId === tag.id}
                          onClick={() => void inviteTag(tag)}
                          className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
                        >
                          {busyTagId === tag.id ? 'Working...' : inviteLabel}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setEditor({
                            tagId: tag.id,
                            label: tag.label,
                            email: tag.email || tag.user?.email || '',
                            phoneNumber:
                              tag.phoneNumber || tag.user?.phoneNumber || tag.contributor?.phoneNumber || '',
                          })
                        }
                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyTagId === tag.id}
                        onClick={() => void removeTag(tag.id)}
                        className="rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:text-rose-800 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {editing && (
                  <div className="mt-4 grid gap-3 rounded-[1.4rem] border border-slate-200 bg-white p-4 sm:grid-cols-3">
                    <label className="text-sm text-slate-700">
                      <div className="mb-2 font-medium">Name</div>
                      <input
                        type="text"
                        value={editor.label}
                        onChange={(event) =>
                          setEditor((current) =>
                            current ? { ...current, label: event.target.value } : current
                          )
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
                      />
                    </label>
                    <label className="text-sm text-slate-700">
                      <div className="mb-2 font-medium">Email</div>
                      <input
                        type="email"
                        value={editor.email}
                        onChange={(event) =>
                          setEditor((current) =>
                            current ? { ...current, email: event.target.value } : current
                          )
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
                      />
                    </label>
                    <label className="text-sm text-slate-700">
                      <div className="mb-2 font-medium">Phone</div>
                      <input
                        type="tel"
                        value={editor.phoneNumber}
                        onChange={(event) =>
                          setEditor((current) =>
                            current ? { ...current, phoneNumber: event.target.value } : current
                          )
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
                      />
                    </label>
                    <div className="sm:col-span-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyTagId === tag.id || !editor.label.trim()}
                        onClick={() => void saveTag()}
                        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                      >
                        {busyTagId === tag.id ? 'Saving...' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditor(null)}
                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canManage && (
        <>
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Quick tag without pinning
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickOptions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Add contributors or friends to unlock quick-tag suggestions.
                </p>
              ) : (
                quickOptions.map((option) => (
                  <button
                    key={`${option.source}-${option.id}`}
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      void createTag(
                        option.source === 'friend'
                          ? {
                              userId: option.id,
                              email: option.email,
                              phoneNumber: option.phoneNumber,
                              label: option.label,
                            }
                          : {
                              contributorId: option.id,
                              email: option.email,
                              phoneNumber: option.phoneNumber,
                              label: option.label,
                            }
                      )
                    }
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950 disabled:opacity-60"
                  >
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!manualLabel.trim()) {
                return;
              }

              void createTag({
                label: manualLabel.trim(),
                email: manualEmail.trim() || null,
                phoneNumber: manualPhoneNumber.trim() || null,
              });
            }}
            className="mt-6 grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr_auto]"
          >
            <input
              type="text"
              value={manualLabel}
              onChange={(event) => setManualLabel(event.target.value)}
              placeholder="Add a name"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
            />
            <input
              type="email"
              value={manualEmail}
              onChange={(event) => setManualEmail(event.target.value)}
              placeholder="Email (optional)"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
            />
            <input
              type="tel"
              value={manualPhoneNumber}
              onChange={(event) => setManualPhoneNumber(event.target.value)}
              placeholder="Phone (optional)"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
            />
            <button
              type="submit"
              disabled={submitting || !manualLabel.trim()}
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Adding...' : 'Add tag'}
            </button>
          </form>
        </>
      )}

      {(error || notice) && (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
            error
              ? 'border border-rose-200 bg-rose-50 text-rose-700'
              : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error || notice}
        </div>
      )}
    </div>
  );
}
