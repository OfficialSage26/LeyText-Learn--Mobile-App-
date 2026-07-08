import { normalizeText, tokenize } from './normalize';
import type { Direction, Lexicon, TokenResult, TranslationResult } from './types';

export async function translate(
  text: string,
  direction: Direction,
  lexicon: Lexicon,
): Promise<TranslationResult> {
  const normalized = normalizeText(text);
  if (normalized === '') {
    return { input: text, output: '', direction, method: 'word-by-word', tokens: [], hasMisses: false };
  }

  const phrase = await lexicon.findPhrase(normalized, direction);
  if (phrase !== null) {
    return { input: text, output: phrase, direction, method: 'phrase', tokens: [], hasMisses: false };
  }

  const tokens: TokenResult[] = [];
  for (const source of tokenize(text)) {
    tokens.push({ source, target: await lexicon.findWord(source, direction) });
  }
  return {
    input: text,
    output: tokens.map((t) => t.target ?? t.source).join(' '),
    direction,
    method: 'word-by-word',
    tokens,
    hasMisses: tokens.some((t) => t.target === null),
  };
}
