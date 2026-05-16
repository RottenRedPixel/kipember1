'use client';

import React from 'react';

export default function EmberTitleBlock({
  title,
  capturedAt,
  createdAt,
}: {
  title: string | null | undefined;
  // The wiki "when" date (analysis.capturedAt — EXIF or user-edited). Prefer
  // this over createdAt (upload timestamp) so the date shown here matches the
  // date the wiki uses.
  capturedAt?: string | null | undefined;
  createdAt: string | null | undefined;
}) {
  const displayDate = capturedAt || createdAt || null;
  if (!title && !displayDate) return null;
  return (
    <div className="px-[10px] pt-3 pb-2 flex-shrink-0">
      {title ? (
        <p className="font-semibold text-right" style={{ fontSize: 20, color: '#fff', letterSpacing: '-0.02em' }}>{title}</p>
      ) : null}
      {displayDate ? (
        <p className="text-right" style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>
          {new Date(displayDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      ) : null}
    </div>
  );
}
