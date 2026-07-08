import { normalizeText, tokenize } from '../normalize';

describe('normalizeText', () => {
  test('lowercases and trims', () => {
    expect(normalizeText('  Kumusta Ka  ')).toBe('kumusta ka');
  });
  test('strips punctuation', () => {
    expect(normalizeText('Saan ang palengke?')).toBe('saan ang palengke');
    expect(normalizeText('¡Salamat, po!')).toBe('salamat po');
  });
  test('collapses internal whitespace', () => {
    expect(normalizeText('magandang    umaga')).toBe('magandang umaga');
  });
  test('keeps apostrophes and hyphens inside words', () => {
    expect(normalizeText("di'ba")).toBe("di'ba");
    expect(normalizeText('araw-araw')).toBe('araw-araw');
  });
  test('empty and punctuation-only input become empty string', () => {
    expect(normalizeText('')).toBe('');
    expect(normalizeText('?!.')).toBe('');
  });
});

describe('tokenize', () => {
  test('splits normalized text into words', () => {
    expect(tokenize('Saan ang palengke?')).toEqual(['saan', 'ang', 'palengke']);
  });
  test('returns empty array for empty input', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});
