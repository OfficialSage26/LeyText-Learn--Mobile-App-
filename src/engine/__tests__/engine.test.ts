import { translate } from '../engine';
import type { AffixRule, Direction, Lexicon } from '../types';

function fakeLexicon(
  phrases: Record<string, string>,
  words: Record<string, string>,
  affixRules: AffixRule[] = [],
): Lexicon {
  return {
    findPhrase: async (t: string, _d: Direction) => phrases[t] ?? null,
    findWord: async (w: string, _d: Direction) => words[w] ?? null,
    findWordCandidates: async (w: string, _d: Direction) =>
      Object.keys(words).filter(
        (k) => k[0] === w[0] && Math.abs(k.length - w.length) <= 2,
      ),
    getAffixRules: async () => affixRules,
  };
}

describe('translate', () => {
  const lex = fakeLexicon(
    { 'saan ang palengke': 'asa ang merkado' },
    { saan: 'asa', ang: 'ang', palengke: 'merkado', maganda: 'gwapa' },
  );

  test('exact phrase match wins and is labeled phrase', async () => {
    const r = await translate('Saan ang palengke?', 'tl-ceb', lex);
    expect(r.output).toBe('asa ang merkado');
    expect(r.method).toBe('phrase');
    expect(r.tokens).toEqual([]);
    expect(r.hasMisses).toBe(false);
  });

  test('falls back to word-by-word with per-token results', async () => {
    const r = await translate('saan ang maganda', 'tl-ceb', lex);
    expect(r.output).toBe('asa ang gwapa');
    expect(r.method).toBe('word-by-word');
    expect(r.tokens).toEqual([
      { source: 'saan', target: 'asa' },
      { source: 'ang', target: 'ang' },
      { source: 'maganda', target: 'gwapa' },
    ]);
    expect(r.hasMisses).toBe(false);
  });

  test('unknown words pass through and set hasMisses', async () => {
    const r = await translate('saan ang xyzzy', 'tl-ceb', lex);
    expect(r.output).toBe('asa ang xyzzy');
    expect(r.hasMisses).toBe(true);
    expect(r.tokens[2]).toEqual({ source: 'xyzzy', target: null });
  });

  test('empty input returns empty result without lexicon calls', async () => {
    const spy = fakeLexicon({}, {});
    const r = await translate('  ?! ', 'tl-ceb', spy);
    expect(r.output).toBe('');
    expect(r.tokens).toEqual([]);
    expect(r.hasMisses).toBe(false);
  });

  test('direction is passed through to the result', async () => {
    const r = await translate('gwapa', 'ceb-tl', fakeLexicon({}, { gwapa: 'maganda' }));
    expect(r.direction).toBe('ceb-tl');
    expect(r.output).toBe('maganda');
  });
});
