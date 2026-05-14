'use client';

import { useEffect } from 'react';

// Snap iOS Safari (and any browser that honors maximum-scale) back to
// 100% zoom. The trick: temporarily force maximum-scale=1.0 on the
// viewport meta, then restore the standard "width=device-width,
// initial-scale=1.0" a tick later so pinch-to-zoom is preserved for
// accessibility.
export function resetZoom() {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  meta.setAttribute(
    'content',
    'width=device-width, initial-scale=1.0, maximum-scale=1.0'
  );
  setTimeout(() => {
    meta.setAttribute('content', 'width=device-width, initial-scale=1.0');
  }, 300);
}

// Fires resetZoom() on mount. Use on top-level screens.
export function useResetZoomOnMount() {
  useEffect(() => {
    resetZoom();
  }, []);
}

// Fires resetZoom() whenever `open` transitions to true. Use on sheets.
export function useResetZoomOnOpen(open: boolean) {
  useEffect(() => {
    if (open) resetZoom();
  }, [open]);
}

// Drop-in client component for server-rendered pages that can't call a
// hook directly (e.g. LandingPage, AboutPage). Renders nothing.
export function ZoomReset() {
  useResetZoomOnMount();
  return null;
}
