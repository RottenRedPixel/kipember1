'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

type KidsStoryPanel = {
  id: string;
  position: number;
  title: string;
  caption: string;
  filename: string;
};

interface KidsFlipbookProps {
  title: string;
  subtitle: string | null;
  summary: string | null;
  panels: KidsStoryPanel[];
}

export default function KidsFlipbook({
  title,
  subtitle,
  summary,
  panels,
}: KidsFlipbookProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(false);

  useEffect(() => {
    if (!autoplay || panels.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % panels.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, [autoplay, panels.length]);

  const currentPanel = panels[currentIndex];

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="ember-panel rounded-[2.25rem] p-6">
        <p className="ember-eyebrow">Kids mode</p>
        <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ember-orange-deep)]">
            {subtitle}
          </p>
        )}
        {summary && (
          <p className="ember-copy mt-4 text-sm">{summary}</p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setAutoplay((prev) => !prev)}
            className="ember-button-primary min-h-0 px-4 py-2.5"
          >
            {autoplay ? 'Pause auto flip' : 'Auto flip'}
          </button>
          <span className="ember-chip">
            {currentIndex + 1} of {panels.length}
          </span>
        </div>

        <div className="mt-8 space-y-3">
          {panels.map((panel, index) => (
            <button
              key={panel.id}
              onClick={() => setCurrentIndex(index)}
              className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                index === currentIndex
                  ? 'border-[rgba(255,102,33,0.16)] bg-[rgba(255,102,33,0.08)] shadow-[0_12px_24px_rgba(255,102,33,0.08)]'
                  : 'border-[rgba(20,20,20,0.06)] bg-white hover:border-[rgba(255,102,33,0.12)] hover:bg-[rgba(255,102,33,0.04)]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ember-muted)]">
                  Scene {panel.position}
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--ember-orange)]" />
              </div>
              <div className="mt-3 font-semibold text-[var(--ember-text)]">
                {panel.title}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="ember-panel-strong relative overflow-hidden rounded-[2.5rem] p-4 sm:p-6">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-48 rounded-full bg-[rgba(255,102,33,0.08)] blur-3xl" />

        <div className="relative rounded-[2rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,247,244,0.92))] p-4 shadow-[0_28px_60px_rgba(17,17,17,0.06)] sm:p-6">
          <div
            key={currentPanel.id}
            className="kids-flip-page grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]"
          >
            <div className="overflow-hidden ember-photo-shell border border-[rgba(20,20,20,0.06)] bg-[var(--ember-bg)]">
              <Image
                src={`/api/uploads/${currentPanel.filename}`}
                alt={currentPanel.title}
                width={1536}
                height={1024}
                unoptimized
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex flex-col justify-between rounded-[1.8rem] border border-[rgba(20,20,20,0.06)] bg-white p-5">
              <div>
                <div className="ember-eyebrow">Story page {currentPanel.position}</div>
                <h3 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">
                  {currentPanel.title}
                </h3>
                <p className="ember-copy mt-4 text-sm">
                  {currentPanel.caption}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  onClick={() =>
                    setCurrentIndex((prev) => (prev - 1 + panels.length) % panels.length)
                  }
                  className="ember-button-secondary min-h-0 px-4 py-2.5"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentIndex((prev) => (prev + 1) % panels.length)}
                  className="ember-button-primary min-h-0 px-4 py-2.5"
                >
                  Next page
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2">
          {panels.map((panel, index) => (
            <button
              key={panel.id}
              onClick={() => setCurrentIndex(index)}
              className={`rounded-full transition-all ${
                index === currentIndex
                  ? 'h-3 w-10 bg-[var(--ember-charcoal)]'
                  : 'h-3 w-3 bg-[rgba(20,20,20,0.16)] hover:bg-[rgba(255,102,33,0.4)]'
              }`}
              title={`Go to page ${panel.position}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
