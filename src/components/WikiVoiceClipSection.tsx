import ClipAudioPlayer from '@/components/ClipAudioPlayer';

type WikiVoiceClip = {
  id: string;
  contributorName: string;
  title: string;
  quote: string;
  significance: string | null;
  audioUrl: string | null;
  startMs?: number | null;
  endMs?: number | null;
  createdAt?: string | null;
};

interface WikiVoiceClipSectionProps {
  clips: WikiVoiceClip[];
  variant?: 'default' | 'overlay';
}

function formatClipRange(startMs?: number | null, endMs?: number | null) {
  if (startMs == null && endMs == null) {
    return '';
  }

  const formatPart = (value?: number | null) => {
    if (value == null || Number.isNaN(value)) {
      return '';
    }

    const totalSeconds = Math.max(0, Math.round(value / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const start = formatPart(startMs);
  const end = formatPart(endMs);
  if (start && end) {
    return `${start} - ${end}`;
  }

  return start || end;
}

export default function WikiVoiceClipSection({
  clips,
  variant = 'default',
}: WikiVoiceClipSectionProps) {
  if (!clips.length) {
    return null;
  }

  const isOverlay = variant === 'overlay';

  return (
    <section
      className={
        isOverlay
          ? 'rounded-[1.8rem] bg-white/34 px-5 py-6 shadow-[0_12px_26px_rgba(0,0,0,0.06)]'
          : 'mt-10 border-t ember-divider pt-8'
      }
    >
      <h3
        className={
          isOverlay
            ? 'text-center text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--ember-text)]'
            : 'ember-heading text-center text-2xl text-[var(--ember-text)]'
        }
      >
        Important Voice Moments
      </h3>

      <div className="mt-5 space-y-4">
        {clips.map((clip) => {
          const clipRange = formatClipRange(clip.startMs, clip.endMs);
          return (
            <article
              key={clip.id}
              className={
                isOverlay
                  ? 'rounded-[1.25rem] bg-white/78 px-4 py-4 text-left shadow-[0_8px_18px_rgba(0,0,0,0.05)]'
                  : 'rounded-[1.5rem] border border-[rgba(20,20,20,0.08)] bg-white/84 px-5 py-5 shadow-[0_10px_24px_rgba(17,17,17,0.04)]'
              }
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <div className="text-sm font-semibold text-[var(--ember-text)]">
                  {clip.title}
                </div>
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--ember-orange-deep)]">
                  {clip.contributorName}
                </div>
                {clipRange && (
                  <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--ember-muted)]">
                    {clipRange}
                  </div>
                )}
              </div>

              <blockquote className="mt-3 border-l-4 border-[var(--ember-orange)] pl-4 text-[0.98rem] italic leading-7 text-[var(--ember-text)]">
                “{clip.quote}”
              </blockquote>

              {clip.significance && (
                <p className="mt-3 text-sm leading-6 text-[var(--ember-muted)]">
                  {clip.significance}
                </p>
              )}

              {clip.audioUrl ? (
                <ClipAudioPlayer
                  src={clip.audioUrl}
                  startMs={clip.startMs}
                  endMs={clip.endMs}
                  className="mt-4"
                />
              ) : (
                <div className="mt-4 text-xs font-medium uppercase tracking-[0.12em] text-[var(--ember-muted)]">
                  Audio unavailable for this clip
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export type { WikiVoiceClip };
