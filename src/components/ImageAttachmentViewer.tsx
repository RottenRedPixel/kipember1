'use client';

import MediaPreview from '@/components/MediaPreview';

export type ImageAttachmentRecord = {
  id: string;
  filename: string;
  mediaType: 'IMAGE' | 'VIDEO';
  posterFilename: string | null;
  durationSeconds: number | null;
  originalName: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

export default function ImageAttachmentViewer({
  attachment,
  canManage,
  draftDescription,
  isSaving,
  isDeleting,
  onDraftChange,
  onSave,
  onDelete,
  onClose,
}: {
  attachment: ImageAttachmentRecord | null;
  canManage: boolean;
  draftDescription: string;
  isSaving: boolean;
  isDeleting: boolean;
  onDraftChange: (value: string) => void;
  onSave?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  if (!attachment) {
    return null;
  }

  const noteChanged = draftDescription.trim() !== (attachment.description || '').trim();

  return (
    <div className="fixed inset-0 z-[72] bg-[rgba(17,17,17,0.58)] px-4 py-6 backdrop-blur-md" onClick={onClose}>
      <div className="mx-auto flex min-h-full w-full max-w-6xl items-center justify-center">
        <div
          className="w-full overflow-hidden rounded-[2.2rem] border border-white/70 bg-white shadow-[0_28px_70px_rgba(15,23,42,0.18)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="min-h-[20rem] overflow-hidden bg-[var(--ember-charcoal)]">
              <MediaPreview
                mediaType={attachment.mediaType}
                filename={attachment.filename}
                posterFilename={attachment.posterFilename}
                originalName={attachment.originalName}
                controls={attachment.mediaType === 'VIDEO'}
                className="h-full max-h-[78vh] w-full object-contain"
              />
            </div>

            <div className="relative flex flex-col px-5 py-5 sm:px-7 sm:py-6">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ember-line)] bg-white text-[var(--ember-text)]"
                aria-label="Close attachment viewer"
              >
                <CloseIcon />
              </button>

              <p className="pr-12 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ember-orange-deep)]">
                Added content
              </p>
              <h3 className="pr-12 pt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--ember-text)] [overflow-wrap:anywhere]">
                {attachment.originalName}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ember-muted)]">
                {attachment.mediaType === 'VIDEO' ? 'Video' : 'Photo'} added{' '}
                {new Date(attachment.createdAt).toLocaleDateString()}.
              </p>

              {canManage ? (
                <div className="mt-5 flex flex-1 flex-col gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
                      Note for this photo or video
                    </label>
                    <textarea
                      value={draftDescription}
                      onChange={(event) => onDraftChange(event.target.value)}
                      placeholder="What should Ember remember from this extra photo or video?"
                      className="ember-textarea"
                      rows={7}
                    />
                  </div>

                  <div className="mt-auto flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={onSave}
                      disabled={isSaving || !noteChanged}
                      className="ember-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? 'Saving...' : 'Save note'}
                    </button>
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={isDeleting}
                      className="w-full rounded-full border border-[rgba(244,63,94,0.18)] px-5 py-3 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDeleting ? 'Removing...' : 'Remove from Ember'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[1.5rem] border border-[rgba(20,20,20,0.08)] bg-[var(--ember-soft)] px-4 py-4 text-sm leading-7 text-[var(--ember-text)]">
                  {attachment.description?.trim() || 'No note has been added for this photo yet.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
