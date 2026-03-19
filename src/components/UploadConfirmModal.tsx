'use client';

import type { ReactNode } from 'react';

type UploadConfirmModalProps = {
  open: boolean;
  preview: string | null;
  mediaType: 'image' | 'video' | null;
  fileName: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  confirmLabel: string;
  confirmBusyLabel: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
};

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

export default function UploadConfirmModal({
  open,
  preview,
  mediaType,
  fileName,
  eyebrow,
  title,
  subtitle,
  confirmLabel,
  confirmBusyLabel,
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
      className="fixed inset-0 z-[65] bg-[rgba(15,23,42,0.42)] px-4 py-6 backdrop-blur-md"
      onClick={onCancel}
    >
      <div className="mx-auto flex min-h-full w-full max-w-4xl items-center justify-center">
        <div
          className="w-full overflow-hidden rounded-[2.2rem] border border-white/70 bg-white shadow-[0_28px_70px_rgba(15,23,42,0.18)]"
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
              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(15,23,42,0),rgba(15,23,42,0.84))] px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/68">
                  {eyebrow}
                </p>
                <div className="mt-2 break-all text-xl font-semibold tracking-[-0.03em] text-white sm:break-words sm:[overflow-wrap:anywhere]">
                  {fileName}
                </div>
              </div>
            </div>

            <div className="relative flex flex-col px-5 py-5 sm:px-7 sm:py-6">
              <button
                type="button"
                onClick={onCancel}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ember-line)] bg-white text-[var(--ember-text)]"
                aria-label="Close upload confirmation"
              >
                <CloseIcon />
              </button>

              <p className="pr-12 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ember-orange-deep)]">
                Ready to send
              </p>
              <h3 className="pr-12 pt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--ember-text)]">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ember-muted)]">{subtitle}</p>

              <div className="mt-5 rounded-[1.5rem] border border-[rgba(255,102,33,0.16)] bg-[rgba(255,102,33,0.05)] px-4 py-4">
                <p className="text-sm font-medium text-[var(--ember-text)]">
                  Nothing uploads until you confirm.
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--ember-muted)]">
                  Ember will process the media, create the memory page, and open it as soon as the first pass is ready.
                </p>
              </div>

              {children && <div className="mt-5 space-y-4">{children}</div>}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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
                  Pick a different file
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
