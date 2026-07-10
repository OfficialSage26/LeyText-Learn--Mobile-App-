# v1.1 Engine Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the translation engine with chunk matching (longest known sub-phrase), affix-aware word lookup (strip/re-attach via a curated mapping table), and fuzzy typo correction with tap-to-undo.

**Architecture:** `translate()` in `src/engine/engine.ts` grows from two tiers to three: whole-phrase match, then a greedy longest-sub-phrase chunk pass, then a per-word resolver chain (exact -> affix -> fuzzy -> miss). Two new pure modules (`fuzzy.ts`, `affixes.ts`) hold the algorithms; `Lexicon` gains `findWordCandidates` and `getAffixRules`; affix mappings are data in `data/affixes.csv` compiled into a new SQLite `affixes` table. The UI surfaces fuzzy corrections with a "keep original" undo.

**Tech Stack:** TypeScript strict, Expo SDK 57 / React Native, expo-sqlite (runtime), better-sqlite3 + csv-parse + tsx (build script), Jest (jest-expo preset).

**Spec:** `docs/superpowers/specs/2026-07-10-v11-engine-upgrade-design.md`

## Global Constraints

- Zero network access at runtime; everything works offline forever.
- Hard app-size cap 150MB total; this upgrade must add approximately 0MB (code + small SQLite table only, no new runtime dependencies).
- Zero raw non-ASCII bytes in any source file: write non-ASCII as `\uXXXX` escapes, and in JSX put escapes inside `{}` expressions (JSX text nodes do not interpret escapes). Verify with `LC_ALL=C grep -rnP '[\x80-\xFF]' <files>` (must print nothing).
- `Direction = 'tl-ceb' | 'ceb-tl'` (exact strings). Method badges come only from `method`: `'phrase'` renders "Exact match", `'word-by-word'` renders "Approximate" (via `METHOD_LABELS`). Only a whole-input phrase match may produce `method: 'phrase'`.
- Every setState-after-await inside a React effect must be guarded by a cancelled flag.
- Commits: plain messages, no Co-Authored-By or any collaborator trailer (the user is the sole author).
- TDD for all engine/data logic. Test output must be pristine. Run the full suite (`npm test`) once before each commit.
- Existing behavior that must not regress: empty input returns empty result without lexicon calls; misses render gray/italic; history/favorites; TTS/mic; the prefix-based "Did you mean" suggestions for a single unknown word stay as-is.

## File Structure

- Create: `src/engine/fuzzy.ts` (edit distance + candidate picking, pure)
- Create: `src/engine/affixes.ts` (affix strip/re-attach resolver, pure)
- Create: `src/engine/__tests__/fuzzy.test.ts`, `src/engine/__tests__/affixes.test.ts`
- Create: `data/affixes.csv` (curated affix mapping data)
- Modify: `src/engine/types.ts` (AffixRule, MatchType, TokenResult, TranslateOptions, Lexicon)
- Modify: `src/engine/engine.ts` (pipeline), `src/engine/__tests__/engine.test.ts`
- Modify: `scripts/build-db.ts` (affixes table + gate)
- Modify: `src/data/dictionary.ts` (two new Lexicon methods)
- Modify: `src/ui/ResultCard.tsx` (correction lines + keep original)
- Modify: `app/(tabs)/index.tsx` (rejectedCorrections state + wiring)

---

### Task 1: Fuzzy matching module

**Files:**
- Create: `src/engine/fuzzy.ts`
- Test: `src/engine/__tests__/fuzzy.test.ts`

**Interfaces:**
- Consumes: nothing (pure strings).
- Produces: `editDistance(a: string, b: string): number`, `maxDistanceFor(word: string): number`, `pickFuzzyMatch(word: string, candidates: string[]): string | null`. Task 5's resolver calls `pickFuzzyMatch`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/fuzzy.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/engine/__tests__/fuzzy.test.ts`
Expected: FAIL - `Cannot find module '../fuzzy'`

- [ ] **Step 3: Write the implementation**

Create `src/engine/fuzzy.ts`:

```ts
// Damerau-Levenshtein distance (optimal string alignment): insertions,
// deletions, substitutions, and adjacent transpositions each cost 1.
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

// Never auto-correct short function words (ang, sa, ng, ...).
export function maxDistanceFor(word: string): number {
  if (word.length < 4) return 0;
  return word.length <= 5 ? 1 : 2;
}

// Best candidate within the word's distance threshold. Deterministic:
// lowest distance wins, ties break alphabetically. Returns null when the
// word is too short to correct or no candidate is close enough.
export function pickFuzzyMatch(word: string, candidates: string[]): string | null {
  const max = maxDistanceFor(word);
  if (max === 0) return null;
  let best: string | null = null;
  let bestDist = max + 1;
  for (const candidate of [...candidates].sort()) {
    if (candidate === word) continue;
    const dist = editDistance(word, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/engine/__tests__/fuzzy.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Full suite + commit**

Run: `npm test` - all suites green, output pristine.

```bash
git add src/engine/fuzzy.ts src/engine/__tests__/fuzzy.test.ts
git commit -m "Add fuzzy matching module with Damerau-Levenshtein distance"
```

---

### Task 2: Affix resolver module

**Files:**
- Modify: `src/engine/types.ts` (append two exports; touch nothing else in the file)
- Create: `src/engine/affixes.ts`
- Test: `src/engine/__tests__/affixes.test.ts`

**Interfaces:**
- Consumes: `Direction` from `src/engine/types.ts`.
- Produces: `AffixType`, `AffixRule { type: AffixType; tl: string; ceb: string }` (in types.ts), and `resolveViaAffix(word: string, direction: Direction, rules: AffixRule[], findWord: (normalizedWord: string, direction: Direction) => Promise<string | null>): Promise<string | null>`. Task 4 stores `AffixRule[]`; Task 5's resolver calls `resolveViaAffix`.

**Semantics (from spec):** strip the source-language form of ONE rule, require the remaining root to be >= 3 letters AND found by `findWord`, then re-attach the target-language form. Rule types: `prefix` and `suffix` attach the same way in both languages. `infix` means the Tagalog side sits after the word's initial consonant cluster (s-in-ulat) while the Cebuano side attaches as a prefix (gi-). Longest source-side affix is tried first (sorted in code, so table order does not matter).

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/affixes.test.ts`:

```ts
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
```

Note on the suffix test: stripping `-in` from "lutuin" leaves root "lutu"; the fake maps lutu -> luto, and re-attaching `-on` yields "lutoon". Vowel alternation (o/u) inside roots is the dictionary curator's concern, not the engine's; the engine just concatenates.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/engine/__tests__/affixes.test.ts`
Expected: FAIL - `Cannot find module '../affixes'` (and `AffixRule` not exported from types).

- [ ] **Step 3: Append types and write the implementation**

Append to `src/engine/types.ts` (leave every existing export untouched):

```ts
export type AffixType = 'prefix' | 'infix' | 'suffix';
export interface AffixRule { type: AffixType; tl: string; ceb: string; }
```

Create `src/engine/affixes.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/engine/__tests__/affixes.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Full suite + commit**

Run: `npm test` - all green, pristine.

```bash
git add src/engine/types.ts src/engine/affixes.ts src/engine/__tests__/affixes.test.ts
git commit -m "Add affix resolver with strip and re-attach mapping"
```

---

### Task 3: Affix data file and build script

**Files:**
- Create: `data/affixes.csv`
- Modify: `scripts/build-db.ts`

**Interfaces:**
- Consumes: nothing from other tasks (AffixRule shape informally: `type,tl,ceb` columns).
- Produces: `affixes` table in `assets/db/dictionary.db` with columns `type TEXT, tl TEXT, ceb TEXT`. Task 4's `getAffixRules` reads it.

- [ ] **Step 1: Create the data file**

Create `data/affixes.csv` (initial draft - the user, who is bilingual, reviews and corrects this file before release; each row is one mapping):

```csv
type,tl,ceb
prefix,nagpa,nagpa
prefix,magpa,magpa
prefix,mang,mang
prefix,pang,pang
prefix,nag,nag
prefix,mag,mag
prefix,pag,pag
prefix,ni,gi
prefix,ipa,ipa
prefix,ka,ka
prefix,ma,ma
prefix,na,na
prefix,pa,pa
prefix,i,i
prefix,um,mo
infix,in,gi
infix,um,mi
suffix,han,han
suffix,hin,on
suffix,an,an
suffix,in,on
```

- [ ] **Step 2: Extend the build script**

In `scripts/build-db.ts`:

Add after the `PhraseRow` interface (line 9):

```ts
interface AffixRow { type: string; tl: string; ceb: string; }

const AFFIX_TYPES = new Set(['prefix', 'infix', 'suffix']);
```

Add to the `db.exec` schema block (after the phrases indexes):

```sql
  CREATE TABLE affixes (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('prefix', 'infix', 'suffix')),
    tl TEXT NOT NULL,
    ceb TEXT NOT NULL
  );
```

Add after the phrases insert loop (before `db.close()`):

```ts
const affixes = readCsv<AffixRow>('data/affixes.csv');
const insertAffix = db.prepare('INSERT INTO affixes (type, tl, ceb) VALUES (?, ?, ?)');
for (const a of affixes) {
  if (!AFFIX_TYPES.has(a.type)) throw new Error(`Unknown affix type "${a.type}" in: ${JSON.stringify(a)}`);
  const tl = normalizeText(a.tl);
  const ceb = normalizeText(a.ceb);
  if (!tl || !ceb) throw new Error(`Bad affix row: ${JSON.stringify(a)}`);
  insertAffix.run(a.type, tl, ceb);
}
```

Update the counts/gate block at the bottom to:

```ts
const counts = { words: words.length, phrases: phrases.length, affixes: affixes.length };
console.log(`Built ${OUT}: ${counts.words} words, ${counts.phrases} phrases, ${counts.affixes} affixes`);
if (counts.words < 800 || counts.phrases < 150 || counts.affixes < 10) {
  console.error('FAIL: below minimum volume (need >=800 words, >=150 phrases, >=10 affixes)');
  process.exit(1);
}
```

(The `db.close()` call must come after the affix insert loop, as before the counts block.)

- [ ] **Step 3: Run the build and verify**

Run: `npm run build:db`
Expected: `Built assets/db/dictionary.db: 917 words, 168 phrases, 21 affixes` and exit code 0.

Run: `npx tsx -e "const db = require('better-sqlite3')('assets/db/dictionary.db'); console.log(db.prepare('SELECT COUNT(*) AS c FROM affixes').get());"`
Expected: `{ c: 21 }`

- [ ] **Step 4: Full suite + commit**

Run: `npm test` - all green.

```bash
git add data/affixes.csv scripts/build-db.ts
git commit -m "Add affix mapping data and affixes table to dictionary build"
```

---

### Task 4: Lexicon interface extension and DictionaryRepo methods

**Files:**
- Modify: `src/engine/types.ts` (Lexicon interface)
- Modify: `src/data/dictionary.ts`
- Modify: `src/engine/__tests__/engine.test.ts` (fake lexicon gains the two new methods so the suite keeps compiling)

**Interfaces:**
- Consumes: `AffixRule` from Task 2; `affixes` table from Task 3.
- Produces: on `Lexicon` and `DictionaryRepo`:
  - `findWordCandidates(normalizedWord: string, direction: Direction): Promise<string[]>`
  - `getAffixRules(): Promise<AffixRule[]>`

Task 5's engine calls both.

- [ ] **Step 1: Extend the Lexicon interface**

In `src/engine/types.ts`, replace the `Lexicon` interface with:

```ts
export interface Lexicon {
  findPhrase(normalizedText: string, direction: Direction): Promise<string | null>;
  findWord(normalizedWord: string, direction: Direction): Promise<string | null>;
  findWordCandidates(normalizedWord: string, direction: Direction): Promise<string[]>;
  getAffixRules(): Promise<AffixRule[]>;
}
```

- [ ] **Step 2: Update the engine test fake so the suite compiles**

In `src/engine/__tests__/engine.test.ts`, replace the `fakeLexicon` helper with (tests themselves are rewritten in Task 5 - here only the fake changes):

```ts
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
```

- [ ] **Step 3: Implement the two methods in DictionaryRepo**

In `src/data/dictionary.ts`:

Change the type import to include AffixRule:

```ts
import type { AffixRule, Direction, Lexicon } from '../engine/types';
```

Add inside `DictionaryRepo` (after `findSuggestions`):

```ts
  private affixRules: AffixRule[] | null = null;

  async findWordCandidates(normalizedWord: string, direction: Direction): Promise<string[]> {
    const col = direction === 'tl-ceb' ? 'tl' : 'ceb';
    const rows = await this.db.getAllAsync<{ w: string }>(
      `SELECT DISTINCT ${col} AS w FROM words
       WHERE substr(${col}, 1, 1) = ? AND abs(length(${col}) - ?) <= 2
       LIMIT 50`,
      normalizedWord.slice(0, 1),
      normalizedWord.length,
    );
    return rows.map((r) => r.w);
  }

  // Affix rules never change at runtime; load once per repo instance.
  async getAffixRules(): Promise<AffixRule[]> {
    if (this.affixRules === null) {
      this.affixRules = await this.db.getAllAsync<AffixRule>(
        'SELECT type, tl, ceb FROM affixes',
      );
    }
    return this.affixRules;
  }
```

- [ ] **Step 4: Verify compile and tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: all suites still green (existing engine tests unchanged in behavior).

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/data/dictionary.ts src/engine/__tests__/engine.test.ts
git commit -m "Extend Lexicon with word candidates and affix rules"
```

---

### Task 5: Engine pipeline - chunk pass and word resolver chain

**Files:**
- Modify: `src/engine/types.ts` (MatchType, TokenResult, TranslateOptions)
- Modify: `src/engine/engine.ts` (full rewrite of translate())
- Test: `src/engine/__tests__/engine.test.ts` (full rewrite)

**Interfaces:**
- Consumes: `pickFuzzyMatch` (Task 1), `resolveViaAffix` (Task 2), `Lexicon.findWordCandidates` / `getAffixRules` (Task 4), `normalizeText` / `tokenize` (existing).
- Produces: `translate(text: string, direction: Direction, lexicon: Lexicon, options?: TranslateOptions): Promise<TranslationResult>`, where `TokenResult` now carries `matchType: 'exact' | 'chunk' | 'affix' | 'fuzzy' | 'miss'` and optional `correction: { from: string; to: string }`. Tasks 6-7 consume `matchType`/`correction` and pass `options.rejectedCorrections`.

- [ ] **Step 1: Update the types**

In `src/engine/types.ts`, replace `TokenResult` and add the new exports so the type section reads:

```ts
export type Direction = 'tl-ceb' | 'ceb-tl';
export type TranslationMethod = 'phrase' | 'word-by-word';
export type MatchType = 'exact' | 'chunk' | 'affix' | 'fuzzy' | 'miss';

export interface TokenResult {
  source: string;                              // original word(s) as typed
  target: string | null;
  matchType: MatchType;
  correction?: { from: string; to: string };   // present iff matchType === 'fuzzy'
}

export interface TranslateOptions {
  rejectedCorrections?: string[];  // normalized words the user chose to keep as typed
}
```

(`TranslationResult`, `AffixRule`, `AffixType`, `Lexicon` stay as they are after Task 4.)

- [ ] **Step 2: Rewrite the engine test file**

Replace the entire body of `src/engine/__tests__/engine.test.ts` with:

```ts
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
```

- [ ] **Step 3: Run tests to verify the new ones fail**

Run: `npx jest src/engine/__tests__/engine.test.ts`
Expected: FAIL - chunk tests and matchType assertions fail against the old two-tier engine (and TS errors for `matchType` on old literal returns until Step 4).

- [ ] **Step 4: Rewrite the engine**

Replace the entire body of `src/engine/engine.ts` with:

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/engine/__tests__/engine.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 6: Full suite, typecheck, commit**

Run: `npm test` then `npx tsc --noEmit`
Expected: all green, no type errors (ResultCard/index.tsx still compile - `TokenResult` gained fields but none were removed; `t.target === null` checks are unaffected).

```bash
git add src/engine/types.ts src/engine/engine.ts src/engine/__tests__/engine.test.ts
git commit -m "Add chunk pass and exact-affix-fuzzy resolver chain to engine"
```

---

### Task 6: ResultCard fuzzy-correction UI

**Files:**
- Modify: `src/ui/ResultCard.tsx`

**Interfaces:**
- Consumes: `TokenResult.matchType` / `correction` from Task 5.
- Produces: new optional prop `onRejectCorrection?: (word: string) => void`. Task 7 passes it.

**Note on testing:** there is no component-test infrastructure in this repo (jest-expo without react-test-renderer / testing-library, and React 19 deprecates react-test-renderer). Per the spec's intent, correction *logic* lives in the engine (already tested in Task 5); this task is presentation only and is verified by typecheck plus manual emulator check in Task 7. Do not add a component-testing dependency.

- [ ] **Step 1: Add the prop and correction rows**

In `src/ui/ResultCard.tsx`:

Add `onRejectCorrection` to the props (after `onToggleFavorite`):

```tsx
export function ResultCard({
  result,
  suggestions,
  isFavorite,
  onToggleFavorite,
  onRejectCorrection,
}: {
  result: TranslationResult;
  suggestions: string[];
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onRejectCorrection?: (word: string) => void;
}) {
```

Insert correction rows between the `hasMisses` note and the `suggestions` note:

```tsx
      {result.tokens
        .filter((t) => t.correction !== undefined)
        .map((t, i) => (
          <View key={i} style={styles.correctionRow}>
            <Text style={styles.note}>
              {'corrected: ' + t.correction!.from + ' \u2192 ' + t.correction!.to}
            </Text>
            {onRejectCorrection && (
              <Pressable
                accessibilityLabel={'Keep original word ' + t.correction!.from}
                onPress={() => onRejectCorrection(t.correction!.from)}
              >
                <Text style={styles.keepOriginal}>keep original</Text>
              </Pressable>
            )}
          </View>
        ))}
```

Add to the `styles` object:

```ts
  correctionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  keepOriginal: { fontSize: 13, color: theme.colors.accent, fontWeight: '600' },
```

(The arrow is the `\u2192` escape inside a `{}` JS expression, so it renders as a real arrow while the source file stays pure ASCII - JSX text nodes would not interpret the escape, which is why it must live in an expression.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` - no errors.
Run: `npm test` - all green.
Run: `LC_ALL=C grep -rnP '[\x80-\xFF]' src/ui/ResultCard.tsx` (Git Bash) - prints nothing.

- [ ] **Step 3: Commit**

```bash
git add src/ui/ResultCard.tsx
git commit -m "Show fuzzy corrections with keep-original action on result card"
```

---

### Task 7: Translate screen wiring and end-to-end verification

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `TranslateOptions` (Task 5), `onRejectCorrection` prop (Task 6).
- Produces: complete v1.1 behavior; nothing downstream.

- [ ] **Step 1: Wire rejectedCorrections state**

In `app/(tabs)/index.tsx`:

Add state after the `isFav` state (line 20):

```tsx
  const [rejectedCorrections, setRejectedCorrections] = useState<string[]>([]);
```

Update the translate effect (lines 36-59): pass options and add the dependency. The call becomes:

```tsx
      const r = await translate(text, direction, dict, { rejectedCorrections });
```

and the dependency array becomes:

```tsx
  }, [text, direction, dict, rejectedCorrections]);
```

Reset rejections whenever the input text or direction changes - update the TextInput and DirectionToggle handlers:

```tsx
        <DirectionToggle
          value={direction}
          onChange={(d) => {
            setDirection(d);
            setRejectedCorrections([]);
          }}
        />
```

```tsx
          onChangeText={(t) => {
            setText(t);
            setRejectedCorrections([]);
          }}
```

Pass the new prop to ResultCard (after `onToggleFavorite`):

```tsx
            onRejectCorrection={(w) =>
              setRejectedCorrections((prev) => (prev.includes(w) ? prev : [...prev, w]))
            }
```

- [ ] **Step 2: Verify compile and full suite**

Run: `npx tsc --noEmit` then `npm test`
Expected: no type errors; all suites green, output pristine.

Run the repo-wide byte scan (Git Bash):
`LC_ALL=C grep -rnP '[\x80-\xFF]' src app scripts data/affixes.csv`
Expected: prints nothing.

- [ ] **Step 3: Manual emulator verification**

Run: `npm run build:db && npx expo run:android` (or reuse the installed dev build with `npx expo start`).

Check on the Translate screen:
1. "Saan ang palengke?" still shows "Asa ang merkado?" with the Exact match badge.
2. "Magandang umaga saan ang palengke" translates both phrases (chunk pass) under the Approximate badge.
3. "Saan ang palengki" auto-corrects, shows "corrected: palengki -> palengke" with "keep original"; tapping it re-translates with palengki untouched (gray/italic).
4. "Nagluto ako" resolves nagluto via the nag- rule (affix tier).
5. Typing anything new clears prior "keep original" choices.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "Wire fuzzy correction undo into translate screen"
```

---

## Post-plan follow-ups (not tasks)

- The user reviews `data/affixes.csv` (bilingual curation) before the v1.1 release, same as `data/dictionary.csv`.
- Release goes through `docs/release-checklist.md`, including the 150MB size-budget gate.
