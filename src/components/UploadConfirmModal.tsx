'use client';

import type { ReactNode } from 'react';

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

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
      className="fixed inset-0 z-[65] overflow-y-auto bg-[rgba(17,17,17,0.34)] px-4 py-6 backdrop-blur-sm sm:py-8"
      onClick={onCancel}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md items-center justify-center">
        <div
          className="relative my-auto w-full overflow-hidden rounded-[2rem] bg-white p-4 shadow-[0_28px_70px_rgba(15,23,42,0.2)]"
          onClick={(event) => event.stopPropagation()}
        >
            <button
              type="button"
              onClick={onCancel}
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ember-line)] bg-white/96 text-[var(--ember-text)] shadow-[0_8px_22px_rgba(17,17,17,0.08)] hover:border-[rgba(255,102,33,0.24)]"
              aria-label="Close create confirmation"
            >
              <CloseIcon />
            </button>
            <div className="space-y-4">
              <div className="ember-photo-shell relative aspect-[0.82] bg-[var(--ember-charcoal)]">
                {mediaType === 'video' ? (
                  <video
                  src={preview || undefined}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={preview || undefined}
                  alt={fileName}
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div className="px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.35rem)]">
              <h3 className="text-[2rem] font-semibold tracking-[-0.04em] text-[var(--ember-text)]">
                {title}
              </h3>
              {subtitle ? (
                <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">{subtitle}</p>
              ) : null}

              {children && <div className="mt-4 space-y-4">{children}</div>}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="inline-flex min-h-[3.4rem] w-full items-center justify-center rounded-[1.05rem] border border-[rgba(20,20,20,0.12)] bg-white px-4 text-base font-medium text-[var(--ember-muted)] shadow-[0_6px_14px_rgba(17,17,17,0.04)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isSubmitting}
                  className="inline-flex min-h-[3.4rem] w-full items-center justify-center rounded-[1.05rem] bg-[var(--ember-orange)] px-4 text-base font-semibold text-white shadow-[0_12px_28px_rgba(255,102,33,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? confirmBusyLabel : confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
