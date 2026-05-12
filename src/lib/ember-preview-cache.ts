/**
 * Thin sessionStorage handoff so EmberViewClient can start rendering
 * the cover image immediately when navigating from a list view.
 *
 * The list (MyEmbersScreen, HomeScreen) already has filename + mediaType
 * for every visible ember — it writes that data here on tap. EmberViewClient
 * reads it on mount and uses it as the initial ember state, skipping the
 * /api/embers/[id] round-trip before the image can appear.
 *
 * The full API fetch still runs in the background to populate the rest of the
 * detail (analysis, contributors, snapshot, etc.).
 */

export type EmberPreview = {
  id: string;
  filename: string;
  mediaType: string;
  posterFilename: string | null;
  title: string | null;
  originalName: string;
  createdAt: string;
};

function key(id: string) {
  return `ember-preview:${id}`;
}

export function writeEmberPreview(data: EmberPreview): void {
  try {
    sessionStorage.setItem(key(data.id), JSON.stringify(data));
  } catch { /* sessionStorage unavailable — silently skip */ }
}

export function readEmberPreview(id: string): EmberPreview | null {
  try {
    const raw = sessionStorage.getItem(key(id));
    return raw ? (JSON.parse(raw) as EmberPreview) : null;
  } catch { return null; }
}
