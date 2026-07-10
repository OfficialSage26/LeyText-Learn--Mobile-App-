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

const NAG: AffixRule = { type: 'prefix', tl: 'nag', ceb: 'nag' };

describe('translate: whole-phrase tier', () => {
  const lex = fakeLexicon(
    { 'saan ang palengke': 'asa ang merkado' },
    { saan: 'asa', ang: 'ang', palengke: 'merkado' },
  );

  test('exact whole-input phrase match wins and is labeled phrase', async () => {
    const r = await translate('Saan ang palengke?', 'tl-ceb', lex);
    expect(r.output).toBe('asa ang merkado');
    expect(r.method).toBe('phrase');
    expect(r.tokens).toEqual([]);
    expect(r.hasMisses).toBe(false);
  });

  test('empty input returns empty result', async () => {
    const r = await translate('  ?! ', 'tl-ceb', fakeLexicon({}, {}));
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

describe('translate: chunk pass', () => {
  const lex = fakeLexicon(
    {
      'magandang umaga': 'maayong buntag',
      'saan ang palengke': 'asa ang merkado',
    },
    { po: 'po' },
  );

  test('adjacent known sub-phrases each match as one chunk', async () => {
    const r = await translate('magandang umaga saan ang palengke', 'tl-ceb', lex);
    expect(r.output).toBe('maayong buntag asa ang merkado');
    expect(r.method).toBe('word-by-word');
    expect(r.tokens).toEqual([
      { source: 'magandang umaga', target: 'maayong buntag', matchType: 'chunk' },
      { source: 'saan ang palengke', target: 'asa ang merkado', matchType: 'chunk' },
    ]);
    expect(r.hasMisses).toBe(false);
  });

  test('chunk plus plain word mix', async () => {
    const r = await translate('magandang umaga po', 'tl-ceb', lex);
    expect(r.output).toBe('maayong buntag po');
    expect(r.tokens).toEqual([
      { source: 'magandang umaga', target: 'maayong buntag', matchType: 'chunk' },
      { source: 'po', target: 'po', matchType: 'exact' },
    ]);
  });

  test('longest window wins over shorter sub-phrase', async () => {
    const greedy = fakeLexicon(
      {
        'saan ang': 'SHORT',
        'saan ang palengke': 'asa ang merkado',
      },
      {},
    );
    const r = await translate('saan ang palengke', 'tl-ceb', greedy);
    // whole input matches tier 1 here; force the chunk pass with a leading word
    const r2 = await translate('po saan ang palengke', 'tl-ceb', greedy);
    expect(r.output).toBe('asa ang merkado');
    expect(r2.tokens[1]).toEqual({
      source: 'saan ang palengke',
      target: 'asa ang merkado',
      matchType: 'chunk',
    });
  });
});

describe('translate: word resolver chain', () => {
  test('exact word lookup is labeled exact', async () => {
    const r = await translate('saan ang maganda', 'tl-ceb', fakeLexicon(
      {},
      { saan: 'asa', ang: 'ang', maganda: 'gwapa' },
    ));
    expect(r.output).toBe('asa ang gwapa');
    expect(r.tokens).toEqual([
      { source: 'saan', target: 'asa', matchType: 'exact' },
      { source: 'ang', target: 'ang', matchType: 'exact' },
      { source: 'maganda', target: 'gwapa', matchType: 'exact' },
    ]);
    expect(r.hasMisses).toBe(false);
  });

  test('affix resolution is labeled affix and beats fuzzy', async () => {
    const r = await translate('nagluto', 'tl-ceb', fakeLexicon(
      {},
      { luto: 'luto', naglut: 'WRONG' },
      [NAG],
    ));
    expect(r.tokens[0]).toEqual({ source: 'nagluto', target: 'nagluto', matchType: 'affix' });
  });

  test('fuzzy correction carries correction info', async () => {
    const r = await translate('palengki', 'tl-ceb', fakeLexicon(
      {},
      { palengke: 'merkado' },
    ));
    expect(r.output).toBe('merkado');
    expect(r.tokens[0]).toEqual({
      source: 'palengki',
      target: 'merkado',
      matchType: 'fuzzy',
      correction: { from: 'palengki', to: 'palengke' },
    });
    expect(r.hasMisses).toBe(false);
  });

  test('rejected corrections turn the fuzzy hit into a miss', async () => {
    const r = await translate('palengki', 'tl-ceb', fakeLexicon(
      {},
      { palengke: 'merkado' },
    ), { rejectedCorrections: ['palengki'] });
    expect(r.output).toBe('palengki');
    expect(r.tokens[0]).toEqual({ source: 'palengki', target: null, matchType: 'miss' });
    expect(r.hasMisses).toBe(true);
  });

  test('short words are never fuzzy-corrected', async () => {
    const r = await translate('ung', 'tl-ceb', fakeLexicon({}, { ang: 'ang' }));
    expect(r.tokens[0]).toEqual({ source: 'ung', target: null, matchType: 'miss' });
  });

  test('unknown words pass through and set hasMisses', async () => {
    const r = await translate('saan ang xyzzy', 'tl-ceb', fakeLexicon(
      {},
      { saan: 'asa', ang: 'ang' },
    ));
    expect(r.output).toBe('asa ang xyzzy');
    expect(r.hasMisses).toBe(true);
    expect(r.tokens[2]).toEqual({ source: 'xyzzy', target: null, matchType: 'miss' });
  });
});
