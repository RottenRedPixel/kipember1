const LOWERCASE_WORDS = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'in', 'of', 'up', 'as', 'is', 'it']);

export function toTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0 || !LOWERCASE_WORDS.has(lower)) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }
      return lower;
    })
    .join(' ');
}

export function getEmberTitle({
  title,
  originalName,
}: {
  title?: string | null;
  originalName?: string | null;
}) {
  const normalizedTitle = typeof title === 'string' ? title.trim() : '';
  if (normalizedTitle) {
    return toTitleCase(normalizedTitle);
  }

  const normalizedOriginalName =
    typeof originalName === 'string' ? originalName.trim() : '';

  return normalizedOriginalName ? toTitleCase(normalizedOriginalName) : 'Untitled Ember';
}
