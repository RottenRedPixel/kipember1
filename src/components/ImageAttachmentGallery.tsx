'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import MediaPreview from '@/components/MediaPreview';
import ImageAttachmentViewer, { type ImageAttachmentRecord } from '@/components/ImageAttachmentViewer';
import UploadConfirmModal from '@/components/UploadConfirmModal';

function detectSelectedMediaType(file: File | null): 'image' | 'video' | null {
  if (!file) {
    return null;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const [newAttachmentDescription, setNewAttachmentDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [activeAttachmentId, setActiveAttachmentId] = useState<string | null>(null);
  const [draftDescriptions, setDraftDescriptions] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const activeAttachment =
    attachments.find((attachment) => attachment.id === activeAttachmentId) || null;
  const selectedMediaType = detectSelectedMediaType(selectedFile);

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
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!canManage) {
      return;
    }

    const openPicker = () => {
      fileInputRef.current?.click();
    };

    window.addEventListener('ember:open-attachment-picker', openPicker);
    return () => window.removeEventListener('ember:open-attachment-picker', openPicker);
  }, [canManage]);

  const attachmentCountLabel = useMemo(() => {
    if (attachments.length === 0) {
      return 'No extra photos or videos yet.';
    }

    return `${attachments.length} added ${attachments.length === 1 ? 'item' : 'items'}`;
  }, [attachments.length]);

  const clearSelection = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setSelectedFile(null);
    setPreviewUrl(null);
    setNewAttachmentDescription('');
    setSelectionError('');
  };

  const handleFileSelection = (file: File | null) => {
    const nextMediaType = detectSelectedMediaType(file);
    if (!file || !nextMediaType) {
      setSelectionError('Only photos and MP4, MOV, WEBM, or M4V videos are supported.');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectionError('');
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleAddAttachment = async () => {
    if (!selectedFile) {
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('description', newAttachmentDescription);

      const response = await fetch(`/api/images/${imageId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to add content');
      }

      await onUpdate();
      clearSelection();
      setNotice(
        payload?.warning
          ? `Added content. ${payload.warning}`
          : 'Added content to this Ember. Regenerate the wiki when you are ready.'
      );
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to add content');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveDescription = async (attachmentId: string) => {
    setSavingId(attachmentId);
    setError('');

    try {
      const response = await fetch(`/api/images/${imageId}/attachments/${attachmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: draftDescriptions[attachmentId] ?? '',
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save note');
      }

      await onUpdate();
      setNotice('Saved the note for this added photo.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save note');
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    const confirmed = window.confirm('Remove this added photo or video from the Ember?');
    if (!confirmed) {
      return;
    }

    setDeletingId(attachmentId);
    setError('');

    try {
      const response = await fetch(`/api/images/${imageId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to remove content');
      }

      await onUpdate();
      if (activeAttachmentId === attachmentId) {
        setActiveAttachmentId(null);
      }
      setNotice('Removed the added content from this Ember.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to remove content');
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
            Extra photos and videos
          </h2>
          <p className="ember-copy mt-2 text-sm">
            Click a thumbnail to open it full size and add detail. These notes will appear in the wiki the next time you regenerate it.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="ember-button-primary shrink-0"
          >
            Add photo or video
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="ember-chip">{attachmentCountLabel}</span>
        <span className="ember-chip">Manual wiki refresh required</span>
      </div>

      {(notice || error || selectionError) && (
        <div className={`mt-4 ember-status ${error || selectionError ? 'ember-status-error' : 'ember-status-success'}`}>
          {error || selectionError || notice}
        </div>
      )}

      <div className="mt-6 rounded-[1.8rem] border border-[rgba(20,20,20,0.08)] bg-white p-4 sm:p-5">
        {attachments.length === 0 ? (
          <div className="rounded-[1.4rem] border border-dashed border-[rgba(20,20,20,0.12)] bg-[var(--ember-soft)] px-5 py-10 text-center text-sm text-[var(--ember-muted)]">
            No extra photos or videos have been added to this Ember yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {attachments.map((attachment) => (
              <button
                key={attachment.id}
                type="button"
                onClick={() => setActiveAttachmentId(attachment.id)}
                className="group overflow-hidden rounded-[1.4rem] border border-[rgba(20,20,20,0.08)] bg-[var(--ember-soft)] text-left transition hover:border-[rgba(255,102,33,0.24)]"
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
                    {attachment.mediaType === 'VIDEO' ? 'Video' : 'Photo'}
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
        accept="image/*,video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
        onChange={(event) => handleFileSelection(event.target.files?.[0] || null)}
        className="hidden"
      />

      <UploadConfirmModal
        open={Boolean(selectedFile && previewUrl && !isUploading)}
        preview={previewUrl}
        mediaType={selectedMediaType}
        fileName={selectedFile?.name || 'Selected media'}
        eyebrow="Added content"
        title="Add this to the Ember?"
        subtitle="This extra photo or video stays attached to the current Ember. It will not start a new interview, but its note can be pulled into the wiki later."
        confirmLabel="Add to Ember"
        confirmBusyLabel="Adding to Ember..."
        isSubmitting={isUploading}
        onCancel={clearSelection}
        onConfirm={() => void handleAddAttachment()}
      >
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
            Note for this photo or video
          </label>
          <textarea
            value={newAttachmentDescription}
            onChange={(event) => setNewAttachmentDescription(event.target.value)}
            placeholder="What should Ember remember from this extra photo or video?"
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
