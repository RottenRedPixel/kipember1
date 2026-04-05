'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import MediaPreview from '@/components/MediaPreview';
import ImageAttachmentViewer, {
  type ImageAttachmentRecord,
} from '@/components/ImageAttachmentViewer';
import UploadConfirmModal from '@/components/UploadConfirmModal';

type SelectedAttachment = {
  file: File;
  mediaType: 'image' | 'video' | 'audio';
  previewUrl: string | null;
};

function detectSelectedMediaType(
  file: File | null
): 'image' | 'video' | 'audio' | null {
  if (!file) {
    return null;
  }

  if (file.type.startsWith('audio/')) {
    return 'audio';
  }

  if (file.type.startsWith('video/')) {
    return 'video';
  }

  if (file.type.startsWith('image/')) {
    return 'image';
  }

  return null;
}

export default function ImageAttachmentGallery({
  imageId,
  canManage,
  attachments,
  onUpdate,
}: {
  imageId: string;
  canManage: boolean;
  attachments: ImageAttachmentRecord[];
  onUpdate: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAttachments, setSelectedAttachments] = useState<
    SelectedAttachment[]
  >([]);
  const [selectionError, setSelectionError] = useState('');
  const [newAttachmentDescription, setNewAttachmentDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [activeAttachmentId, setActiveAttachmentId] = useState<string | null>(
    null
  );
  const [draftDescriptions, setDraftDescriptions] = useState<
    Record<string, string>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const activeAttachment =
    attachments.find((attachment) => attachment.id === activeAttachmentId) ||
    null;
  const selectedFiles = selectedAttachments.map((attachment) => attachment.file);
  const selectedPreviewUrl = selectedAttachments[0]?.previewUrl || null;
  const selectedMediaType = selectedAttachments[0]?.mediaType || null;

  useEffect(() => {
    setDraftDescriptions((current) => {
      const next = { ...current };
      for (const attachment of attachments) {
        next[attachment.id] = next[attachment.id] ?? attachment.description ?? '';
      }

      for (const attachmentId of Object.keys(next)) {
        if (!attachments.some((attachment) => attachment.id === attachmentId)) {
          delete next[attachmentId];
        }
      }

      return next;
    });
  }, [attachments]);

  useEffect(() => {
    if (!notice && !error) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice('');
      setError('');
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [notice, error]);

  useEffect(() => {
    return () => {
      for (const attachment of selectedAttachments) {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      }
    };
  }, [selectedAttachments]);

  useEffect(() => {
    if (!canManage) {
      return;
    }

    const openPicker = () => {
      fileInputRef.current?.click();
    };

    window.addEventListener('ember:open-attachment-picker', openPicker);
    return () =>
      window.removeEventListener('ember:open-attachment-picker', openPicker);
  }, [canManage]);

  const attachmentCountLabel = useMemo(() => {
    if (attachments.length === 0) {
      return 'No extra photos, videos, or audio yet.';
    }

    return `${attachments.length} added ${
      attachments.length === 1 ? 'item' : 'items'
    }`;
  }, [attachments.length]);

  const clearSelection = () => {
    for (const attachment of selectedAttachments) {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setSelectedAttachments([]);
    setNewAttachmentDescription('');
    setSelectionError('');
  };

  const handleFileSelection = (files: FileList | null) => {
    const nextFiles = Array.from(files || []);

    if (nextFiles.length === 0) {
      setSelectionError('No files were selected.');
      return;
    }

    const nextSelectedAttachments: SelectedAttachment[] = [];

    for (const file of nextFiles) {
      const mediaType = detectSelectedMediaType(file);

      if (!mediaType) {
        setSelectionError(
          'Only photos, videos, and common audio files are supported.'
        );
        return;
      }

      nextSelectedAttachments.push({
        file,
        mediaType,
        previewUrl:
          mediaType === 'audio' ? null : URL.createObjectURL(file),
      });
    }

    for (const attachment of selectedAttachments) {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    }

    setSelectionError('');
    setSelectedAttachments(nextSelectedAttachments);
  };

  const handleAddAttachment = async () => {
    if (selectedFiles.length === 0) {
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      for (const file of selectedFiles) {
        formData.append('files', file);
      }

      if (newAttachmentDescription.trim()) {
        formData.append('description', newAttachmentDescription.trim());
      }

      const response = await fetch(`/api/images/${imageId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to add content');
      }

      await onUpdate();
      const uploadedCount = selectedFiles.length;
      clearSelection();

      const warnings = Array.isArray(payload?.warnings)
        ? payload.warnings.filter(
            (warning: unknown): warning is string =>
              typeof warning === 'string' && warning.trim().length > 0
          )
        : [];

      setNotice(
        warnings.length > 0
          ? `Added ${uploadedCount} item${
              uploadedCount === 1 ? '' : 's'
            }. ${warnings[0]}`
          : `Added ${uploadedCount} item${
              uploadedCount === 1 ? '' : 's'
            } to this Ember. Regenerate the wiki when you are ready.`
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : 'Failed to add content'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveDescription = async (attachmentId: string) => {
    setSavingId(attachmentId);
    setError('');

    try {
      const response = await fetch(
        `/api/images/${imageId}/attachments/${attachmentId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: draftDescriptions[attachmentId] ?? '',
          }),
        }
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save note');
      }

      await onUpdate();
      setNotice('Saved the note for this added media.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save note');
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    const confirmed = window.confirm('Remove this added media from the Ember?');
    if (!confirmed) {
      return;
    }

    setDeletingId(attachmentId);
    setError('');

    try {
      const response = await fetch(
        `/api/images/${imageId}/attachments/${attachmentId}`,
        {
          method: 'DELETE',
        }
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to remove content');
      }

      await onUpdate();
      if (activeAttachmentId === attachmentId) {
        setActiveAttachmentId(null);
      }
      setNotice('Removed the added media from this Ember.');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Failed to remove content'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section id="ember-attachments" className="ember-panel rounded-[2rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="ember-eyebrow">Added content</p>
          <h2 className="ember-heading mt-3 text-2xl text-[var(--ember-text)]">
            Extra photos, videos, and audio
          </h2>
          <p className="ember-copy mt-2 text-sm">
            Click a media tile to open it and add detail. These notes will appear
            in the wiki the next time you regenerate it.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="ember-button-primary shrink-0"
          >
            Add media
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="ember-chip">{attachmentCountLabel}</span>
        <span className="ember-chip">Manual wiki refresh required</span>
      </div>

      {(notice || error || selectionError) && (
        <div
          className={`mt-4 ember-status ${
            error || selectionError ? 'ember-status-error' : 'ember-status-success'
          }`}
        >
          {error || selectionError || notice}
        </div>
      )}

      <div className="mt-6 rounded-[1.8rem] border border-[rgba(20,20,20,0.08)] bg-white p-4 sm:p-5">
        {attachments.length === 0 ? (
          <div className="rounded-[1.4rem] border border-dashed border-[rgba(20,20,20,0.12)] bg-[var(--ember-soft)] px-5 py-10 text-center text-sm text-[var(--ember-muted)]">
            No extra photos, videos, or audio have been added to this Ember yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {attachments.map((attachment) => (
              <button
                key={attachment.id}
                type="button"
                onClick={() => setActiveAttachmentId(attachment.id)}
                className="group overflow-hidden ember-photo-shell border border-[rgba(20,20,20,0.08)] bg-[var(--ember-soft)] text-left transition hover:border-[rgba(255,102,33,0.24)]"
              >
                <div className="overflow-hidden bg-[var(--ember-charcoal)]">
                  <MediaPreview
                    mediaType={attachment.mediaType}
                    filename={attachment.filename}
                    posterFilename={attachment.posterFilename}
                    originalName={attachment.originalName}
                    usePosterForVideo
                    className="h-28 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="space-y-1 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ember-muted)]">
                    {attachment.mediaType === 'VIDEO'
                      ? 'Video'
                      : attachment.mediaType === 'AUDIO'
                        ? 'Audio'
                        : 'Photo'}
                  </div>
                  <div className="line-clamp-2 text-xs leading-5 text-[var(--ember-muted)]">
                    {attachment.description?.trim() || 'Open to add a note.'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/quicktime,video/webm,video/x-m4v,audio/*,.mp4,.mov,.webm,.m4v,.mp3,.wav,.m4a,.aac,.ogg,.oga,.mpga,.mpeg"
        multiple
        onChange={(event) => handleFileSelection(event.target.files)}
        className="hidden"
      />

      <UploadConfirmModal
        open={selectedAttachments.length > 0}
        preview={selectedPreviewUrl}
        mediaType={selectedMediaType}
        fileName={
          selectedAttachments.length === 1
            ? selectedFiles[0]?.name || 'Selected media'
            : `${selectedAttachments.length} files selected`
        }
        title="Add this to the Ember?"
        subtitle="These extra files stay attached to the current Ember. They will not start a new interview, but their notes can be pulled into the wiki later."
        confirmLabel="Add to Ember"
        confirmBusyLabel="Adding to Ember..."
        isSubmitting={isUploading}
        onCancel={clearSelection}
        onConfirm={() => void handleAddAttachment()}
      >
        <div>
          <div className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
            Selected media
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-[1.2rem] border border-[var(--ember-line)] bg-[var(--ember-soft)] px-3 py-3 text-sm text-[var(--ember-text)]">
            {selectedAttachments.map((attachment) => (
              <div
                key={`${attachment.file.name}-${attachment.file.lastModified}`}
                className="flex items-center justify-between gap-3"
              >
                <span className="truncate">{attachment.file.name}</span>
                <span className="shrink-0 text-xs font-medium uppercase tracking-[0.16em] text-[var(--ember-muted)]">
                  {attachment.mediaType}
                </span>
              </div>
            ))}
          </div>
          <label className="mt-4 mb-2 block text-sm font-medium text-[var(--ember-text)]">
            Optional starter note
          </label>
          <textarea
            value={newAttachmentDescription}
            onChange={(event) => setNewAttachmentDescription(event.target.value)}
            placeholder="Add one note for this batch now, or open each item afterward and add details there."
            className="ember-textarea"
            rows={4}
          />
        </div>
      </UploadConfirmModal>

      <ImageAttachmentViewer
        attachment={activeAttachment}
        canManage={canManage}
        draftDescription={activeAttachment ? draftDescriptions[activeAttachment.id] ?? '' : ''}
        isSaving={activeAttachment ? savingId === activeAttachment.id : false}
        isDeleting={activeAttachment ? deletingId === activeAttachment.id : false}
        onDraftChange={(value) => {
          if (!activeAttachment) {
            return;
          }

          setDraftDescriptions((current) => ({
            ...current,
            [activeAttachment.id]: value,
          }));
        }}
        onSave={
          activeAttachment
            ? () => {
                void handleSaveDescription(activeAttachment.id);
              }
            : undefined
        }
        onDelete={
          activeAttachment
            ? () => {
                void handleDeleteAttachment(activeAttachment.id);
              }
            : undefined
        }
        onClose={() => setActiveAttachmentId(null)}
      />
    </section>
  );
}
