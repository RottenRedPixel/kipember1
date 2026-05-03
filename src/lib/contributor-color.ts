// Deterministic pastel-color picker for contributor avatars.
//
// Same key → same color forever, so a contributor's avatar bubble looks
// identical in the wiki, the chat blocks, the tend slider, the contributor
// list, and the photo-tag bubbles. Uses a small palette of soft pastels so
// adjacent rows stay visually distinct without being loud.
//
// Pass a stable identifier per contributor — pool Contributor.id is ideal.
// EmberContributor.id, the pool dedup `key` (e:email / p:phone / u:userId),
// or the contributor's display name all work too; just pick one and stick
// with it for a given surface so the color stays consistent.

const PASTEL_PALETTE = [
  '#fda4af', // pink
  '#fcd34d', // yellow
  '#86efac', // green
  '#93c5fd', // blue
  '#c4b5fd', // purple
  '#fdba74', // orange
  '#67e8f9', // cyan
  '#f9a8d4', // rose
  '#a7f3d0', // mint
  '#fde68a', // cream
] as const;

export function pastelForContributor(key: string | null | undefined): string {
  const source = (key ?? '').trim();
  if (!source) return PASTEL_PALETTE[0];
  // Cheap deterministic hash — adequate for picking 1 of 10 buckets.
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) | 0;
  }
  return PASTEL_PALETTE[Math.abs(hash) % PASTEL_PALETTE.length];
}
