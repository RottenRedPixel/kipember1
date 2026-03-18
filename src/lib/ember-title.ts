export function getEmberTitle({
  title,
  originalName,
}: {
  title?: string | null;
  originalName?: string | null;
}) {
  const normalizedTitle = typeof title === 'string' ? title.trim() : '';
  if (normalizedTitle) {
    return normalizedTitle;
  }

  const normalizedOriginalName =
    typeof originalName === 'string' ? originalName.trim() : '';

  return normalizedOriginalName || 'Untitled Ember';
}
