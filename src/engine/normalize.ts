// Curly single quotes are apostrophe variants (phone keyboards substitute
// \u2019 for '), so map them to a straight apostrophe instead of stripping.
const APOSTROPHE_VARIANTS = /[\u2018\u2019]/g;
// Strip punctuation but keep straight apostrophes and hyphens (used inside
// Tagalog/Cebuano words like di'ba, araw-araw).
const PUNCTUATION = /[.,!?;:"\u201C\u201D()[\]{}\u00BF\u00A1\u2026\u2013\u2014/\\]/g;

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(APOSTROPHE_VARIANTS, "'")
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized === '' ? [] : normalized.split(' ');
}
