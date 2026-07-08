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
  test('strips curly double quotes', () => {
    expect(normalizeText('\u201CKumusta?\u201D')).toBe('kumusta');
  });
  test('maps curly apostrophes to straight apostrophe inside words', () => {
    expect(normalizeText('di\u2019ba')).toBe("di'ba");
    expect(normalizeText('\u2018di\u2019ba\u2019')).toBe("'di'ba'");
  });
});

describe('tokenize', () => {
  test('splits normalized text into words', () => {
    expect(tokenize('Saan ang palengke?')).toEqual(['saan', 'ang', 'palengke']);
  });
  test('returns empty array for empty input', () => {
    expect(tokenize('   ')).toEqual([]);
  });
  test('curly apostrophe does not split a word', () => {
    expect(tokenize('di\u2019ba kumusta')).toEqual(["di'ba", 'kumusta']);
  });
});
