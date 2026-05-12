'use client';

import React from 'react';

export default function EmberTitleBlock({
  title,
  createdAt,
}: {
  title: string | null | undefined;
  createdAt: string | null | undefined;
}) {
  if (!title && !createdAt) return null;
  return (
    <div className="px-[10px] pt-3 pb-2 flex-shrink-0">
      {title ? (
        <p className="font-semibold text-right" style={{ fontSize: 20, color: '#fff', letterSpacing: '-0.02em' }}>{title}</p>
      ) : null}
      {createdAt ? (
        <p className="text-right" style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>
          {new Date(createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      ) : null}
    </div>
  );
}
