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

function PreviewSurface({
  preview,
  mediaType,
  fileName,
}: {
  preview: string | null;
  mediaType: 'image' | 'video' | 'audio' | null;
  fileName: string;
}) {
  if (mediaType === 'video') {
    return (
      <video
        src={preview || undefined}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    );
  }

  if (mediaType === 'audio') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-[rgba(255,255,255,0.03)] px-6 text-center text-white">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/6 text-[var(--ember-orange-deep)]">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10" aria-hidden="true">
            <path d="M12 3a1 1 0 0 1 1 1v9.55A4 4 0 1 1 11 17V7.82l6-1.34V14a4 4 0 1 1-2-3.46V7.91l-4 .9V17a4 4 0 1 1-2-3.46V4a1 1 0 0 1 1-1h2Z" />
          </svg>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium text-white">Audio clip</div>
          <div className="text-xs leading-6 text-white/46">{fileName}</div>
        </div>
        {preview ? <audio src={preview} controls preload="metadata" className="w-full" /> : null}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={preview || undefined}
      alt={fileName}
      className="h-full w-full object-cover"
    />
  );
}

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
        ? 'Create this Ember from the selected video?'
        : 'Create this Ember from the selected image?';

    return (
      <div className="fixed inset-0 z-[65] bg-[rgba(0,0,0,0.42)] backdrop-blur-md">
        <div className="mx-auto flex h-full w-full max-w-[28rem] flex-col bg-[var(--kip-bg-screen)] lg:max-w-[68rem]">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <PreviewSurface preview={preview} mediaType={mediaType} fileName={fileName} />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.28),transparent_24%,transparent_54%,rgba(0,0,0,0.78))]" />

            <button
              type="button"
              onClick={onCancel}
              className="kip-home-button absolute right-4 top-4 z-10 text-white"
              aria-label="Close create confirmation"
            >
              <CloseIcon />
            </button>

            <div className="kip-panel absolute inset-x-4 bottom-4 z-10 rounded-[1.7rem] p-5 text-white lg:inset-x-6 lg:bottom-6 lg:max-w-[36rem]">
              <span className="kip-pill">Ready to create</span>
              <p className="mt-4 text-[1.35rem] font-semibold leading-[1.1] tracking-[-0.04em] text-white">
                {promptLabel}
              </p>
              {subtitle ? (
                <p className="mt-3 text-sm leading-6 text-[var(--kip-text-secondary)]">{subtitle}</p>
              ) : null}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="kip-secondary-button w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isSubmitting}
                  className="kip-primary-button w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? confirmBusyLabel : confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[65] overflow-y-auto bg-[rgba(0,0,0,0.44)] px-4 py-6 backdrop-blur-md sm:py-8"
      onClick={onCancel}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md items-center justify-center lg:max-w-3xl">
        <div
          className="relative my-auto w-full overflow-hidden rounded-[2rem] border border-white/10 bg-[rgba(10,10,10,0.9)] p-4 text-white shadow-[0_28px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onCancel}
            className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white hover:border-white/18"
            aria-label="Close create confirmation"
          >
            <CloseIcon />
          </button>

          <div className="space-y-4">
            <div className="ember-photo-shell relative aspect-[0.82] overflow-hidden bg-[var(--ember-charcoal)]">
              <PreviewSurface preview={preview} mediaType={mediaType} fileName={fileName} />
            </div>

            <div className="px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.35rem)]">
              <h3 className="text-[2rem] font-semibold tracking-[-0.05em] text-white">
                {title}
              </h3>
              {subtitle ? (
                <p className="mt-2 text-sm leading-7 text-white/56">{subtitle}</p>
              ) : null}

              {children ? <div className="mt-4 space-y-4">{children}</div> : null}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="ember-button-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isSubmitting}
                  className="ember-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
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
