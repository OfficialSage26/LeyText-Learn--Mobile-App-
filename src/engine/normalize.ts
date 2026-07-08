// Strip punctuation but keep straight apostrophes and hyphens (used inside
// Tagalog/Cebuano words like di'ba, araw-araw).
const PUNCTUATION = /[.,!?;:"""’’()\[\]{}¿¡…–—/\\]/g;

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized === '' ? [] : normalized.split(' ');
}
