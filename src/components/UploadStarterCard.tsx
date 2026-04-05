'use client';

import type { DragEvent } from 'react';

type UploadStarterCardProps = {
  title: string;
  subtitle: string;
  supportText: string;
  isDragging: boolean;
  onOpenPicker: () => void;
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void;
  onDragLeave: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>) => void;
};

function UploadArrowIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="text-[var(--ember-muted)]"
    >
      <path
        d="M12 16V5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 9.5L12 5L16.5 9.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 15.5V17.5C5 18.6046 5.89543 19.5 7 19.5H17C18.1046 19.5 19 18.6046 19 17.5V15.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function UploadStarterCard({
  title,
  subtitle,
  supportText,
  isDragging,
  onOpenPicker,
  onDragOver,
  onDragLeave,
  onDrop,
}: UploadStarterCardProps) {
  return (
    <div className="px-1 pt-1 pb-1 text-center">
      <h2 className="ember-heading text-[2.45rem] font-semibold leading-[1.02] text-[var(--ember-text)]">
        {title}
      </h2>
      <p className="ember-copy mx-auto mt-2 max-w-[18rem] text-[0.98rem] leading-7 text-[var(--ember-muted)]">
        {subtitle}
      </p>

      <button
        type="button"
        onClick={onOpenPicker}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`mt-9 flex w-full flex-col items-center rounded-[2.2rem] border border-dashed px-6 py-[4.25rem] text-center transition ${
          isDragging
            ? 'border-[rgba(255,102,33,0.35)] bg-[rgba(255,102,33,0.05)]'
            : 'border-[rgba(20,20,20,0.12)] bg-white'
        }`}
      >
        <span className="inline-flex h-[4.85rem] w-[4.85rem] items-center justify-center rounded-full bg-[rgba(20,20,20,0.03)]">
          <UploadArrowIcon />
        </span>

        <p className="mt-6 whitespace-nowrap text-[1.08rem] font-normal tracking-[-0.02em] text-[var(--ember-text)]">
          Drop your photo here, or{' '}
          <span className="font-medium text-[var(--ember-orange-deep)]">browse</span>
        </p>
        <p className="mt-4 text-[0.92rem] leading-6 text-[var(--ember-muted)]">{supportText}</p>
      </button>
    </div>
  );
}
