'use client';

import type { StoryCircleEntry } from '@/lib/story-circle';

function formatThreadDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatThreadTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sourceLabel(source: StoryCircleEntry['source']) {
  switch (source) {
    case 'sms':
      return 'SMS';
    case 'voice':
      return 'Voice';
    case 'web':
      return 'Web';
    default:
      return 'Story';
  }
}

export default function StoryCircleThread({
  entries,
}: {
  entries: StoryCircleEntry[];
}) {
  if (entries.length === 0) {
    return (
      <div className="ember-panel rounded-[2rem] border-dashed px-8 py-16 text-center text-[var(--ember-muted)]">
        No conversation history yet. Once people text or speak with Ember, their story thread will appear here.
      </div>
    );
  }

  return (
    <div className="ember-panel-strong rounded-[2.25rem] p-4 sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {entries.map((entry, index) => {
          const previousEntry = index > 0 ? entries[index - 1] : null;
          const showDateDivider =
            !previousEntry ||
            formatThreadDate(previousEntry.timestamp) !== formatThreadDate(entry.timestamp);

          const isContributor = entry.actor === 'contributor';
          const isSystem = entry.actor === 'system';

          return (
            <div key={entry.id}>
              {showDateDivider && (
                <div className="mb-4 mt-2 flex justify-center">
                  <span className="ember-chip px-4 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--ember-muted)]">
                    {formatThreadDate(entry.timestamp)}
                  </span>
                </div>
              )}

              <div
                className={`flex ${
                  isSystem ? 'justify-center' : isContributor ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] ${
                    isSystem
                      ? 'rounded-[1.7rem] border border-[rgba(255,102,33,0.14)] bg-[rgba(255,102,33,0.08)] px-4 py-3 text-center text-[var(--ember-text)]'
                      : isContributor
                        ? 'rounded-[1.7rem] rounded-br-md bg-[var(--ember-charcoal)] px-4 py-3 text-white shadow-[0_18px_34px_rgba(17,17,17,0.16)]'
                        : 'rounded-[1.7rem] rounded-bl-md border border-[rgba(20,20,20,0.08)] bg-white px-4 py-3 text-[var(--ember-text)] shadow-[0_12px_28px_rgba(17,17,17,0.06)]'
                  }`}
                >
                  <div
                    className={`mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      isSystem
                        ? 'justify-center text-[var(--ember-orange-deep)]'
                        : isContributor
                          ? 'text-white/60'
                          : 'text-[var(--ember-orange-deep)]'
                    }`}
                  >
                    <span>{entry.participantLabel}</span>
                    <span
                      className={
                        isSystem
                          ? 'text-[var(--ember-orange)]'
                          : isContributor
                            ? 'text-white/40'
                            : 'text-[rgba(255,102,33,0.5)]'
                      }
                    >
                      /
                    </span>
                    <span>{sourceLabel(entry.source)}</span>
                    {entry.actor !== 'system' && entry.contributorName?.trim() && entry.actor === 'ember' && (
                      <>
                        <span className="text-[rgba(255,102,33,0.5)]">/</span>
                        <span>with {entry.contributorName.trim()}</span>
                      </>
                    )}
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-7">
                    {entry.content}
                  </p>

                  <div
                    className={`mt-2 text-[11px] ${
                      isSystem
                        ? 'text-[var(--ember-orange-deep)]/75'
                        : isContributor
                          ? 'text-white/65'
                          : 'text-[var(--ember-muted)]'
                    }`}
                  >
                    {formatThreadTime(entry.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
