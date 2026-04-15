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
    <div className="ember-panel rounded-[2rem] p-6">
      <div className="mb-4">
        <p className="ember-eyebrow">Tag people</p>
        <h2 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">Tagged people</h2>
        <p className="ember-copy mt-2 text-sm">
          Review tagged faces, add contact info, and turn tags into contributor invites.
        </p>
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-[var(--ember-muted)]">No one has been tagged yet.</p>
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
                className="ember-card rounded-[1.6rem] px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-[var(--ember-text)]">{tag.label}</h3>
                      {tag.leftPct !== null && tag.topPct !== null && (
                        <span className="ember-chip text-[var(--ember-orange-deep)]">
                          Pinned on photo
                        </span>
                      )}
                      {tag.userId && (
                        <span className="ember-chip">
                          Linked account
                        </span>
                      )}
                      {tag.contributorId && (
                        <span className="ember-chip text-emerald-700">
                          Contributor
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-[var(--ember-muted)]">
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
                          className="ember-button-secondary min-h-0 px-4 py-2 text-[var(--ember-orange-deep)] disabled:opacity-60"
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
                        className="ember-button-secondary min-h-0 px-4 py-2"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyTagId === tag.id}
                        onClick={() => void removeTag(tag.id)}
                        className="ember-button-secondary min-h-0 px-4 py-2 text-rose-700 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {editing && (
                  <div className="mt-4 grid gap-3 rounded-[1.4rem] border border-[var(--ember-line)] bg-white p-4 sm:grid-cols-3">
                    <label className="text-sm text-[var(--ember-text)]">
                      <div className="mb-2 font-medium">Name</div>
                      <input
                        type="text"
                        value={editor.label}
                        onChange={(event) =>
                          setEditor((current) =>
                            current ? { ...current, label: event.target.value } : current
                          )
                        }
                        className="ember-input"
                      />
                    </label>
                    <label className="text-sm text-[var(--ember-text)]">
                      <div className="mb-2 font-medium">Email</div>
                      <input
                        type="email"
                        value={editor.email}
                        onChange={(event) =>
                          setEditor((current) =>
                            current ? { ...current, email: event.target.value } : current
                          )
                        }
                        className="ember-input"
                      />
                    </label>
                    <label className="text-sm text-[var(--ember-text)]">
                      <div className="mb-2 font-medium">Phone</div>
                      <input
                        type="tel"
                        value={editor.phoneNumber}
                        onChange={(event) =>
                          setEditor((current) =>
                            current ? { ...current, phoneNumber: event.target.value } : current
                          )
                        }
                        className="ember-input"
                      />
                    </label>
                    <div className="sm:col-span-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyTagId === tag.id || !editor.label.trim()}
                        onClick={() => void saveTag()}
                        className="ember-button-primary min-h-0 px-4 py-2 disabled:opacity-60"
                      >
                        {busyTagId === tag.id ? 'Saving...' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditor(null)}
                        className="ember-button-secondary min-h-0 px-4 py-2"
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
            <p className="ember-eyebrow">
              Quick tag without pinning
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickOptions.length === 0 ? (
                <p className="text-sm text-[var(--ember-muted)]">
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
                    className="ember-button-secondary min-h-0 px-4 py-2 disabled:opacity-60"
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
              className="ember-input"
            />
            <input
              type="email"
              value={manualEmail}
              onChange={(event) => setManualEmail(event.target.value)}
              placeholder="Email (optional)"
              className="ember-input"
            />
            <input
              type="tel"
              value={manualPhoneNumber}
              onChange={(event) => setManualPhoneNumber(event.target.value)}
              placeholder="Phone (optional)"
              className="ember-input"
            />
            <button
              type="submit"
              disabled={submitting || !manualLabel.trim()}
              className="ember-button-primary disabled:opacity-60"
            >
              {submitting ? 'Adding...' : 'Add tag'}
            </button>
          </form>
        </>
      )}

      {(error || notice) && (
        <div
          className={`mt-4 ember-status ${error ? 'ember-status-error' : 'ember-status-success'}`}
        >
          {error || notice}
        </div>
      )}
    </div>
  );
}
