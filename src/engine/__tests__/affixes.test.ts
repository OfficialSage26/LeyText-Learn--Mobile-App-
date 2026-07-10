import { resolveViaAffix } from '../affixes';
import type { AffixRule, Direction } from '../types';

const RULES: AffixRule[] = [
  { type: 'prefix', tl: 'nag', ceb: 'nag' },
  { type: 'prefix', tl: 'ni', ceb: 'gi' },
  { type: 'infix', tl: 'in', ceb: 'gi' },
  { type: 'suffix', tl: 'in', ceb: 'on' },
];

function fakeFindWord(words: Record<string, string>) {
  return async (w: string, _d: Direction) => words[w] ?? null;
}

describe('resolveViaAffix', () => {
  const findWord = fakeFindWord({ luto: 'luto', sulat: 'sulat' });

  test('prefix: strips and re-attaches the mapped prefix', async () => {
    expect(await resolveViaAffix('nagluto', 'tl-ceb', RULES, findWord)).toBe('nagluto');
  });

  test('prefix with different target form: niluto becomes giluto', async () => {
    expect(await resolveViaAffix('niluto', 'tl-ceb', RULES, findWord)).toBe('giluto');
  });

  test('infix: tl infix maps to ceb prefix (sinulat -> gisulat)', async () => {
    expect(await resolveViaAffix('sinulat', 'tl-ceb', RULES, findWord)).toBe('gisulat');
  });

  test('suffix: lutuin maps -in to -on', async () => {
    const f = fakeFindWord({ lutu: 'luto' });
    expect(await resolveViaAffix('lutuin', 'tl-ceb', RULES, f)).toBe('lutoon');
  });

  test('reverse direction: giluto maps back via ceb prefix gi (first matching rule)', async () => {
    expect(await resolveViaAffix('giluto', 'ceb-tl', RULES, findWord)).toBe('niluto');
  });

  test('rejects when stripped root is shorter than 3 letters', async () => {
    const f = fakeFindWord({ na: 'na' });
    expect(await resolveViaAffix('nagna', 'tl-ceb', RULES, f)).toBeNull();
  });

  test('rejects when root is not in the dictionary', async () => {
    expect(await resolveViaAffix('nagxyzzy', 'tl-ceb', RULES, findWord)).toBeNull();
  });

  test('longest source affix is tried first', async () => {
    const rules: AffixRule[] = [
      { type: 'prefix', tl: 'na', ceb: 'na' },
      { type: 'prefix', tl: 'nagpa', ceb: 'nagpa' },
    ];
    const f = fakeFindWord({ luto: 'luto', gpaluto: 'WRONG' });
    expect(await resolveViaAffix('nagpaluto', 'tl-ceb', rules, f)).toBe('nagpaluto');
  });

  test('returns null when no rule matches', async () => {
    expect(await resolveViaAffix('kamusta', 'tl-ceb', RULES, findWord)).toBeNull();
  });

  test('applies at most one rule (no stacking)', async () => {
    // nagpaluto with only nag- rule: root paluto is not in dictionary -> null,
    // never strips nag- then pa- in sequence.
    const f = fakeFindWord({ luto: 'luto' });
    expect(await resolveViaAffix('nagpaluto', 'tl-ceb', [RULES[0]], f)).toBeNull();
  });
});
