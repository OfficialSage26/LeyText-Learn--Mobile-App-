import { resolveViaAffix } from './affixes';
import { pickFuzzyMatch } from './fuzzy';
import { normalizeText, tokenize } from './normalize';
import type {
  Direction,
  Lexicon,
  TokenResult,
  TranslateOptions,
  TranslationResult,
} from './types';

const MAX_CHUNK_WORDS = 6;

async function resolveWord(
  word: string,
  direction: Direction,
  lexicon: Lexicon,
  rejected: Set<string>,
): Promise<TokenResult> {
  const exact = await lexicon.findWord(word, direction);
  if (exact !== null) return { source: word, target: exact, matchType: 'exact' };

  const rules = await lexicon.getAffixRules();
  const viaAffix = await resolveViaAffix(word, direction, rules, (w, d) =>
    lexicon.findWord(w, d),
  );
  if (viaAffix !== null) return { source: word, target: viaAffix, matchType: 'affix' };

  if (!rejected.has(word)) {
    const candidates = await lexicon.findWordCandidates(word, direction);
    const corrected = pickFuzzyMatch(word, candidates);
    if (corrected !== null) {
      const target = await lexicon.findWord(corrected, direction);
      if (target !== null) {
        return {
          source: word,
          target,
          matchType: 'fuzzy',
          correction: { from: word, to: corrected },
        };
      }
    }
  }

  return { source: word, target: null, matchType: 'miss' };
}

export async function translate(
  text: string,
  direction: Direction,
  lexicon: Lexicon,
  options?: TranslateOptions,
): Promise<TranslationResult> {
  const normalized = normalizeText(text);
  if (normalized === '') {
    return { input: text, output: '', direction, method: 'word-by-word', tokens: [], hasMisses: false };
  }

  const phrase = await lexicon.findPhrase(normalized, direction);
  if (phrase !== null) {
    return { input: text, output: phrase, direction, method: 'phrase', tokens: [], hasMisses: false };
  }

  const rejected = new Set(options?.rejectedCorrections ?? []);
  const words = tokenize(text);
  const tokens: TokenResult[] = [];
  let i = 0;
  while (i < words.length) {
    let chunk: TokenResult | null = null;
    for (let n = Math.min(MAX_CHUNK_WORDS, words.length - i); n >= 2; n--) {
      const span = words.slice(i, i + n).join(' ');
      const hit = await lexicon.findPhrase(span, direction);
      if (hit !== null) {
        chunk = { source: span, target: hit, matchType: 'chunk' };
        i += n;
        break;
      }
    }
    if (chunk !== null) {
      tokens.push(chunk);
      continue;
    }
    tokens.push(await resolveWord(words[i], direction, lexicon, rejected));
    i += 1;
  }

  return {
    input: text,
    output: tokens.map((t) => t.target ?? t.source).join(' '),
    direction,
    method: 'word-by-word',
    tokens,
    hasMisses: tokens.some((t) => t.matchType === 'miss'),
  };
}
