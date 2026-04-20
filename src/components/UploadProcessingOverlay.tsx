'use client';

import { Loader2 } from 'lucide-react';

type UploadProcessingOverlayProps = {
  open: boolean;
  stageIndex: number;
  mediaType: 'image' | 'video' | null;
};

const PROCESSING_STAGES = [
  {
    title: 'Reading the scene',
    detail: 'Ember is pulling the first visual cues and detecting the media format.',
  },
  {
    title: 'Checking memory context',
    detail: 'Dates, location clues, and metadata are being folded into the new Ember.',
  },
  {
    title: 'Opening the workspace',
    detail: 'The memory shell, chat panel, and story tools are being prepared now.',
  },
] as const;


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
    <div className="fixed inset-0 z-[80] bg-[rgba(0,0,0,0.44)] backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-[28rem] flex-col bg-[var(--kip-bg-screen)] text-white lg:max-w-[68rem]">
        <div className="relative flex min-h-0 flex-1 flex-col justify-between overflow-hidden px-5 py-6 lg:px-8 lg:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,122,26,0.18),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_36%)]" />

          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center text-center">
            <div className="text-[var(--ember-orange-deep)]">
              <Loader2 className="h-28 w-28 animate-spin" aria-hidden="true" />
            </div>

            <span className="kip-pill mt-8">{currentMediaLabel}</span>

            <div className="mt-5 max-w-[15rem] space-y-3 lg:max-w-[24rem]">
              <h2 className="text-[1.9rem] font-semibold leading-[1.02] tracking-[-0.05em] text-white">
                {stage.title}
              </h2>
              <p className="text-sm leading-7 text-[var(--kip-text-secondary)]">{stage.detail}</p>
            </div>
          </div>

          <div className="kip-surface relative rounded-[1.45rem] px-4 py-4 text-center lg:mx-auto lg:w-full lg:max-w-[34rem]">
            <p className="text-sm leading-6 text-white/78">
              Your memory is being created. Ember will open the full layout as soon as it is ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
