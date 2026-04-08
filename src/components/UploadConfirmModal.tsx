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
  mediaType: 'image' | 'video' | 'audio' | null;
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
  layout?: 'card' | 'create-screen';
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
  layout = 'card',
}: UploadConfirmModalProps) {
  if (!open) {
    return null;
  }

  if (layout === 'create-screen') {
    const promptLabel =
      mediaType === 'video'
        ? 'Would you like to create an ember from this video?'
        : 'Would you like to create an ember from this photo?';

    return (
      <div className="fixed inset-x-0 top-[2.7rem] bottom-0 z-[65]">
        <div className="mx-auto flex h-full w-full max-w-[26rem] flex-col">
          <div className="relative min-h-0 basis-[70%] overflow-hidden bg-[#a6b78f]">
            {mediaType === 'video' ? (
              <video
                src={preview || undefined}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : mediaType === 'audio' ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-8 text-center text-white">
                <div className="text-[1.75rem] font-medium tracking-[-0.03em]">{fileName}</div>
                {preview ? (
                  <audio src={preview} controls preload="metadata" className="w-full max-w-[18rem]" />
                ) : null}
              </div>
            ) : (
              <img
                src={preview || undefined}
                alt={fileName}
                className="h-full w-full object-cover"
              />
            )}
          </div>

          <div className="min-h-0 basis-[30%] bg-[var(--ember-orange)] px-10 py-8 text-white">
            <p className="max-w-[15rem] text-[1.12rem] leading-[1.28] tracking-[-0.03em]">
              {promptLabel}
            </p>

            <div className="mt-7 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="inline-flex min-h-[3.15rem] w-full items-center justify-center bg-[#efb39b] px-4 text-[1.02rem] font-semibold uppercase tracking-[-0.01em] text-[var(--ember-orange-deep)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isSubmitting}
                className="inline-flex min-h-[3.15rem] w-full items-center justify-center bg-white px-4 text-[1.02rem] font-semibold uppercase tracking-[-0.01em] text-[var(--ember-orange-deep)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? confirmBusyLabel : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
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
              ) : mediaType === 'audio' ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-[var(--ember-soft)] px-6 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(255,102,33,0.12)] text-[var(--ember-orange)]">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10" aria-hidden="true">
                      <path d="M12 3a1 1 0 0 1 1 1v9.55A4 4 0 1 1 11 17V7.82l6-1.34V14a4 4 0 1 1-2-3.46V7.91l-4 .9V17a4 4 0 1 1-2-3.46V4a1 1 0 0 1 1-1h2Z" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-[var(--ember-text)]">Audio clip</div>
                    <div className="text-xs leading-6 text-[var(--ember-muted)]">{fileName}</div>
                  </div>
                  {preview ? (
                    <audio
                      src={preview}
                      controls
                      preload="metadata"
                      className="w-full"
                    />
                  ) : null}
                </div>
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
