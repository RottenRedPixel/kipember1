'use client';

import type { ReactNode } from 'react';

type UploadConfirmModalProps = {
  open: boolean;
  preview: string | null;
  mediaType: 'image' | 'video' | null;
  fileName: string;
  title: string;
  subtitle: string;
  confirmLabel: string;
  confirmBusyLabel: string;
  cancelLabel?: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
};

export default function UploadConfirmModal({
  open,
  preview,
  mediaType,
  fileName,
  title,
  subtitle,
  confirmLabel,
  confirmBusyLabel,
  cancelLabel = 'Pick a different file',
  isSubmitting,
  onCancel,
  onConfirm,
  children,
}: UploadConfirmModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[65] overflow-y-auto bg-[rgba(15,23,42,0.42)] px-4 py-4 backdrop-blur-md sm:py-6"
      onClick={onCancel}
    >
      <div className="mx-auto flex min-h-full w-full max-w-4xl items-start justify-center sm:items-center">
        <div
          className="my-auto w-full overflow-hidden rounded-[2.2rem] border border-white/70 bg-white shadow-[0_28px_70px_rgba(15,23,42,0.18)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="grid gap-0 md:grid-cols-[1.05fr_0.95fr]">
            <div className="relative min-h-[18rem] overflow-hidden bg-[var(--ember-charcoal)]">
              {mediaType === 'video' ? (
                <video
                  src={preview || undefined}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-contain"
                />
              ) : (
                <img
                  src={preview || undefined}
                  alt={fileName}
                  className="h-full w-full object-contain"
                />
              )}
            </div>

            <div className="relative flex flex-col px-5 py-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:px-7 sm:py-6">
              <h3 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--ember-text)]">
                {title}
              </h3>
              {subtitle ? (
                <p className="mt-3 text-sm leading-7 text-[var(--ember-muted)]">{subtitle}</p>
              ) : null}

              {children && <div className="mt-5 space-y-4">{children}</div>}

              <div className="mt-6 flex flex-col gap-3 sm:mt-auto sm:flex-row">
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isSubmitting}
                  className="ember-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? confirmBusyLabel : confirmLabel}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="ember-button-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
