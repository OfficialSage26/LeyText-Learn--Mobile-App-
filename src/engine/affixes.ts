import type { AffixRule, Direction } from './types';

const MIN_ROOT_LEN = 3;
// Initial consonant cluster, for Tagalog infix placement: s-in-ulat.
const INITIAL_CONSONANTS = /^[bcdfghjklmnpqrstvwxyz]+/;

type FindWord = (normalizedWord: string, direction: Direction) => Promise<string | null>;

function sourceForm(rule: AffixRule, direction: Direction): string {
  return direction === 'tl-ceb' ? rule.tl : rule.ceb;
}

// The Tagalog side of an infix rule is a true infix; the Cebuano side
// attaches as a prefix (gi-). Prefix/suffix rules attach the same way in
// both languages.
function placement(rule: AffixRule, side: 'tl' | 'ceb'): 'prefix' | 'infix' | 'suffix' {
  if (rule.type === 'infix') return side === 'tl' ? 'infix' : 'prefix';
  return rule.type;
}

function stripSource(word: string, rule: AffixRule, direction: Direction): string | null {
  const side = direction === 'tl-ceb' ? 'tl' : 'ceb';
  const form = sourceForm(rule, direction);
  switch (placement(rule, side)) {
    case 'prefix':
      return word.startsWith(form) ? word.slice(form.length) : null;
    case 'suffix':
      return word.endsWith(form) ? word.slice(0, word.length - form.length) : null;
    case 'infix': {
      const cluster = word.match(INITIAL_CONSONANTS);
      if (cluster === null) return null;
      const head = cluster[0];
      if (!word.startsWith(head + form)) return null;
      return head + word.slice(head.length + form.length);
    }
  }
}

function attachTarget(translatedRoot: string, rule: AffixRule, direction: Direction): string {
  const side = direction === 'tl-ceb' ? 'ceb' : 'tl';
  const form = direction === 'tl-ceb' ? rule.ceb : rule.tl;
  switch (placement(rule, side)) {
    case 'prefix':
      return form + translatedRoot;
    case 'suffix':
      return translatedRoot + form;
    case 'infix': {
      const cluster = translatedRoot.match(INITIAL_CONSONANTS);
      // Vowel-initial roots take the affix as a plain prefix (upo -> umupo).
      if (cluster === null) return form + translatedRoot;
      return cluster[0] + form + translatedRoot.slice(cluster[0].length);
    }
  }
}

// Try each rule, longest source-side affix first: strip it, require a root
// of >= 3 letters that the dictionary knows, then re-attach the mapped
// target-side affix to the translated root. One rule maximum; the first
// rule that yields a dictionary root wins.
export async function resolveViaAffix(
  word: string,
  direction: Direction,
  rules: AffixRule[],
  findWord: FindWord,
): Promise<string | null> {
  const ordered = [...rules].sort(
    (a, b) => sourceForm(b, direction).length - sourceForm(a, direction).length,
  );
  for (const rule of ordered) {
    const root = stripSource(word, rule, direction);
    if (root === null || root.length < MIN_ROOT_LEN) continue;
    const translatedRoot = await findWord(root, direction);
    if (translatedRoot === null) continue;
    return attachTarget(translatedRoot, rule, direction);
  }
  return null;
}
