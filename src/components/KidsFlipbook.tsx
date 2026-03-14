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
    <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-8">
      <aside className="rounded-[2rem] border border-amber-200/70 bg-white/75 backdrop-blur p-6 shadow-[0_24px_60px_rgba(168,85,247,0.12)]">
        <div className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
          Kids Mode
        </div>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-base font-medium text-rose-700">{subtitle}</p>
        )}
        {summary && (
          <p className="mt-4 text-sm leading-6 text-slate-600">{summary}</p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => setAutoplay((prev) => !prev)}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            {autoplay ? 'Pause Flipbook' : 'Auto Flip'}
          </button>
          <span className="text-xs uppercase tracking-[0.22em] text-slate-400">
            {currentIndex + 1} / {panels.length}
          </span>
        </div>

        <div className="mt-8 space-y-3">
          {panels.map((panel, index) => (
            <button
              key={panel.id}
              onClick={() => setCurrentIndex(index)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                index === currentIndex
                  ? 'border-rose-300 bg-rose-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Scene {panel.position}
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-amber-400 to-rose-500" />
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {panel.title}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="relative overflow-hidden rounded-[2.5rem] border border-amber-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(254,240,138,0.55),_rgba(255,255,255,0.9)_42%,_rgba(251,207,232,0.72)_100%)] p-4 sm:p-6 shadow-[0_28px_80px_rgba(217,70,239,0.16)]">
        <div className="pointer-events-none absolute -left-12 top-12 h-36 w-36 rounded-full bg-amber-300/35 blur-3xl" />
        <div className="pointer-events-none absolute -right-8 bottom-12 h-40 w-40 rounded-full bg-sky-300/30 blur-3xl" />

        <div className="relative rounded-[2rem] bg-white/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_18px_40px_rgba(148,163,184,0.22)] backdrop-blur">
          <div key={currentPanel.id} className="kids-flip-page grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-5">
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-100">
              <Image
                src={`/api/uploads/${currentPanel.filename}`}
                alt={currentPanel.title}
                width={1536}
                height={1024}
                unoptimized
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex flex-col justify-between rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(255,251,235,0.96))] p-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-500">
                  Story Page {currentPanel.position}
                </div>
                <h3 className="mt-3 text-2xl font-black leading-tight text-slate-900">
                  {currentPanel.title}
                </h3>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  {currentPanel.caption}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  onClick={() =>
                    setCurrentIndex((prev) => (prev - 1 + panels.length) % panels.length)
                  }
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentIndex((prev) => (prev + 1) % panels.length)}
                  className="rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
                >
                  Next Page
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
              className={`h-3 rounded-full transition-all ${
                index === currentIndex
                  ? 'w-10 bg-gradient-to-r from-amber-400 to-rose-500'
                  : 'w-3 bg-slate-300 hover:bg-slate-400'
              }`}
              title={`Go to page ${panel.position}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
