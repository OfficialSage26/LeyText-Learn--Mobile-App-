export type Direction = 'tl-ceb' | 'ceb-tl';
export type TranslationMethod = 'phrase' | 'word-by-word';
export interface TokenResult { source: string; target: string | null; }
export interface TranslationResult {
  input: string;
  output: string;
  direction: Direction;
  method: TranslationMethod;
  tokens: TokenResult[];   // empty when method === 'phrase'
  hasMisses: boolean;
}
export interface Lexicon {
  findPhrase(normalizedText: string, direction: Direction): Promise<string | null>;
  findWord(normalizedWord: string, direction: Direction): Promise<string | null>;
  findWordCandidates(normalizedWord: string, direction: Direction): Promise<string[]>;
  getAffixRules(): Promise<AffixRule[]>;
}
export type AffixType = 'prefix' | 'infix' | 'suffix';
export interface AffixRule { type: AffixType; tl: string; ceb: string; }
