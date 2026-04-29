function stripInlineMarkdown(value: string) {
  return value
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[`*_>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeNarrationText(value: string) {
  return stripInlineMarkdown(value)
    .normalize('NFKC')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—−]/g, '-')
    .replace(/[…]/g, '...')
    .replace(/[•]/g, ' ')
    .replace(/\b(?:vs\.?|v\.)\b/gi, ' versus ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTextForSpeech(value: string) {
  return normalizeNarrationText(value)
    .replace(/([A-Za-z])\s+['’]\s*([A-Za-z])/g, "$1'$2")
    .replace(/([A-Za-z])['’]\s+([A-Za-z])/g, "$1'$2")
    .replace(/([A-Za-z])'([A-Za-z])/g, '$1’$2')
    .replace(/([A-Za-z])\s+['’]\s*(s|d|ll|re|ve|m|t)\b/g, "$1'$2")
    .replace(/([A-Za-z])['’]\s+(s|d|ll|re|ve|m|t)\b/g, "$1'$2")
    .replace(/\b([A-Za-z]+)['’]s\b/g, '$1’s')
    .replace(/\b([A-Za-z]+)['’](d|ll|re|ve|m|t)\b/g, '$1’$2')
    .replace(/\s+/g, ' ')
    .trim();
}
