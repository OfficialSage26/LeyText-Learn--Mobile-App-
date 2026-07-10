import { editDistance, maxDistanceFor, pickFuzzyMatch } from '../fuzzy';

describe('editDistance', () => {
  test('identical strings are distance 0', () => {
    expect(editDistance('palengke', 'palengke')).toBe(0);
  });

  test('single substitution is 1', () => {
    expect(editDistance('palengki', 'palengke')).toBe(1);
  });

  test('single insertion and deletion are 1', () => {
    expect(editDistance('palengk', 'palengke')).toBe(1);
    expect(editDistance('palengkee', 'palengke')).toBe(1);
  });

  test('adjacent transposition is 1, not 2', () => {
    expect(editDistance('plaengke', 'palengke')).toBe(1);
  });

  test('empty string distance is other length', () => {
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
  });

  test('unrelated words have large distance', () => {
    expect(editDistance('saan', 'merkado')).toBeGreaterThan(2);
  });
});

describe('maxDistanceFor', () => {
  test('words under 4 letters never fuzzy-match', () => {
    expect(maxDistanceFor('ang')).toBe(0);
    expect(maxDistanceFor('sa')).toBe(0);
  });

  test('4-5 letter words allow distance 1', () => {
    expect(maxDistanceFor('saan')).toBe(1);
    expect(maxDistanceFor('gwapa')).toBe(1);
  });

  test('6+ letter words allow distance 2', () => {
    expect(maxDistanceFor('palengke')).toBe(2);
  });
});

describe('pickFuzzyMatch', () => {
  test('picks the closest candidate within threshold', () => {
    expect(pickFuzzyMatch('palengki', ['palengke', 'pagkain'])).toBe('palengke');
  });

  test('returns null when nothing is within threshold', () => {
    expect(pickFuzzyMatch('xyzzy', ['palengke', 'pagkain'])).toBeNull();
  });

  test('returns null for words shorter than 4 letters', () => {
    expect(pickFuzzyMatch('ung', ['ang'])).toBeNull();
  });

  test('ties break alphabetically for determinism', () => {
    // both are distance 1 from "bata"
    expect(pickFuzzyMatch('bata', ['batx', 'bats'])).toBe('bats');
  });

  test('exact candidate is skipped (exact match is handled earlier)', () => {
    expect(pickFuzzyMatch('saan', ['saan', 'sabaw'])).toBeNull();
  });

  test('empty candidate list returns null', () => {
    expect(pickFuzzyMatch('palengke', [])).toBeNull();
  });
});
