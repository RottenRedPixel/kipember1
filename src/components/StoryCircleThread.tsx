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
      <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/85 px-8 py-16 text-center text-slate-500 shadow-sm">
        No conversation history yet. Once people text or speak with Ember, their story thread will appear here.
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_50%,#f8fafc_100%)] p-4 shadow-sm sm:p-6">
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
                  <span className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
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
                      ? 'rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-amber-900'
                      : isContributor
                        ? 'rounded-[1.6rem] rounded-br-md bg-emerald-500 px-4 py-3 text-white shadow-sm'
                        : 'rounded-[1.6rem] rounded-bl-md bg-white px-4 py-3 text-slate-900 shadow-sm ring-1 ring-slate-200'
                  }`}
                >
                  <div
                    className={`mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      isSystem ? 'justify-center text-amber-700' : isContributor ? 'text-emerald-50' : 'text-slate-500'
                    }`}
                  >
                    <span>{entry.participantLabel}</span>
                    <span className={isSystem ? 'text-amber-400' : isContributor ? 'text-emerald-200' : 'text-slate-300'}>
                      •
                    </span>
                    <span>{sourceLabel(entry.source)}</span>
                    {entry.actor !== 'system' && entry.contributorName?.trim() && entry.actor === 'ember' && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span>with {entry.contributorName.trim()}</span>
                      </>
                    )}
                  </div>

                  <p className={`whitespace-pre-wrap text-sm leading-6 ${isSystem ? 'text-sm' : ''}`}>
                    {entry.content}
                  </p>

                  <div
                    className={`mt-2 text-[11px] ${
                      isSystem ? 'text-amber-700/80' : isContributor ? 'text-emerald-50/85' : 'text-slate-400'
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
