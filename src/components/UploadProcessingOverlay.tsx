'use client';

import HeaderMenu from '@/components/HeaderMenu';

type UploadProcessingOverlayProps = {
  open: boolean;
  stageIndex: number;
  mediaType: 'image' | 'video' | null;
};

const PROCESSING_STAGES = [
  {
    title: 'ANALYSING IMAGE',
    topBackground: '#1a2027',
    topText: '#6f777f',
    bottomBackground: '#7b4d3c',
    bottomText: '#c79c86',
    showCurrentMediaPill: true,
  },
  {
    title: 'CHECKING EXIF DATA',
    topBackground: '#000000',
    topText: '#ffffff',
    bottomBackground: '#e96a2f',
    bottomText: '#ffffff',
    showCurrentMediaPill: false,
  },
  {
    title: 'COMPLETING EMBER',
    topBackground: '#000000',
    topText: '#ffffff',
    bottomBackground: '#e96a2f',
    bottomText: '#ffffff',
    showCurrentMediaPill: false,
  },
] as const;

function ProcessingHeader() {
  return (
    <div className="flex h-[2.65rem] items-center justify-between bg-[#1a1a1a] px-4 text-[0.76rem] uppercase tracking-[-0.02em]">
      <span className="text-[#d7d7d7]">Home</span>
      <span className="text-[#6f6f6f]">Embers</span>
      <HeaderMenu
        authMode="detect"
        className="text-[#6f6f6f] hover:text-white"
        panelClassName="right-0 top-[calc(100%+0.3rem)] min-w-[8.5rem] rounded-[0.85rem] border border-white/10 bg-[#1b1b1b] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
        iconClassName="h-4 w-4"
        logoutRedirectTo="/"
      />
    </div>
  );
}

function SpinnerCycleIcon({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      className="h-28 w-28 animate-[spin_5s_linear_infinite]"
      aria-hidden="true"
    >
      <path
        d="M38 24c9-5 24-5 33 0"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M66 14l10 10-13 2"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M86 39c6 8 9 21 4 31"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="m94 63-1 14-11-7"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M77 88c-8 7-20 11-31 7"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="m53 98-13-2 8-10"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M32 81c-7-8-10-20-6-31"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="m24 57 2-13 10 7"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function UploadProcessingOverlay({
  open,
  stageIndex,
  mediaType,
}: UploadProcessingOverlayProps) {
  if (!open) {
    return null;
  }

  const stage = PROCESSING_STAGES[Math.min(stageIndex, PROCESSING_STAGES.length - 1)];
  const currentMediaLabel = mediaType === 'video' ? 'Current video' : 'Current image';

  return (
    <div className="fixed inset-0 z-[80] bg-[rgba(0,0,0,0.22)]">
      <div className="mx-auto flex h-full w-full max-w-[26rem] flex-col bg-white">
        <ProcessingHeader />

        <div
          className="flex h-[calc(100%-2.65rem)] min-h-0 flex-col"
          style={{ backgroundColor: stage.topBackground }}
        >
          <div className="flex min-h-0 basis-[70%] flex-col items-center justify-center px-8 text-center">
            <SpinnerCycleIcon color={stage.topText} />

            <div
              className="mt-6 text-[0.96rem] font-medium uppercase tracking-[-0.02em]"
              style={{ color: stage.topText }}
            >
              {stage.title}
            </div>

            {stage.showCurrentMediaPill ? (
              <div className="mt-8 rounded-full border border-[#8f979f] px-4 py-[0.35rem] text-[0.88rem] font-semibold text-white">
                {currentMediaLabel}
              </div>
            ) : null}
          </div>

          <div
            className="flex min-h-0 basis-[30%] items-start justify-center px-8 py-8 text-center"
            style={{ backgroundColor: stage.bottomBackground, color: stage.bottomText }}
          >
            <p className="text-[1.02rem] font-medium tracking-[-0.02em]">
              Your memory is being created.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
