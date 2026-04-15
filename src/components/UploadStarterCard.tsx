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
      className="text-white/62"
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
    <div className="px-1 py-1 text-white">
      <div className="space-y-2 text-center lg:text-left">
        <span className="kip-pill mx-auto w-fit lg:mx-0">Upload</span>
        <h2 className="text-[2rem] font-semibold leading-[1.02] tracking-[-0.05em] text-white lg:text-[2.85rem]">
          {title}
        </h2>
        <p className="mx-auto max-w-[24rem] text-[0.95rem] leading-7 text-[var(--kip-text-secondary)] lg:mx-0 lg:max-w-[34rem]">
          {subtitle}
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenPicker}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`mt-7 flex min-h-[23rem] w-full flex-col items-center justify-center rounded-[1.75rem] border border-dashed px-6 py-12 text-center transition lg:min-h-[31rem] ${
          isDragging
            ? 'border-[rgba(249,115,22,0.46)] bg-[rgba(249,115,22,0.1)]'
            : 'border-white/14 bg-[rgba(255,255,255,0.03)]'
        }`}
      >
        <span className="inline-flex h-[5rem] w-[5rem] items-center justify-center rounded-full border border-white/10 bg-white/6">
          <UploadArrowIcon />
        </span>

        <p className="mt-6 max-w-[16rem] text-[1.02rem] font-medium tracking-[-0.03em] text-white sm:max-w-none">
          Drop your file here, or <span className="text-[var(--kip-accent)]">browse</span>
        </p>
        <p className="mt-3 max-w-[23rem] text-[0.92rem] leading-6 text-[var(--kip-text-secondary)] lg:max-w-[28rem]">
          {supportText}
        </p>
      </button>
    </div>
  );
}
