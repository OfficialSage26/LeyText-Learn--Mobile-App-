# v1.1 Engine Upgrade: Chunk Matching, Affix Handling, Fuzzy Correction

**Date:** 2026-07-10
**Status:** Approved
**Depends on:** v1.0.0 (shipped engine: `translate()` two-tier phrase / word-by-word)

## Problem

Users report accuracy problems with the v1 engine:

1. **Long input** never matches a stored phrase, so it always falls to word-by-word,
   the weakest tier. Sentences composed of several known phrases (e.g.
   "magandang umaga saan ang palengke") are translated word-per-word even though
   the data to do better already exists.
2. **Conjugated words** miss. Tagalog and Cebuano are agglutinative: "nagluto",
   "magluto", "niluto" all share root "luto", but `findWord` only matches exact
   stored forms.
3. **Misspellings** miss. Casual spelling variation is common in both languages
   (o/u and e/i swaps, "palengki" for "palengke"). A one-letter typo produces an
   untranslated word.

All fixes must stay pure TypeScript + SQLite: the app has a hard 150MB size cap
(see release checklist) and a zero-network guarantee. This upgrade adds ~0MB.

## Solution Overview

`translate()` grows from two tiers to a three-tier pipeline, all behind the
existing `Lexicon` seam (the v2 neural slot is untouched):

```
input
  -> normalize
  -> [1] whole-phrase match            -> method 'phrase'   ("Exact match")
  -> [2] chunk pass (longest sub-phrases via findPhrase on token windows)
  -> [3] word resolver per leftover word:
         exact findWord
         -> affix (strip -> root lookup -> re-attach mapped affix)
         -> fuzzy (Damerau-Levenshtein vs. SQL-narrowed candidates)
         -> miss (pass through untranslated)
  -> method 'word-by-word'             ("Approximate")
```

Only a whole-input phrase match earns the "Exact match" badge. Everything else
stays "Approximate" regardless of how many chunks hit.

## Components

### 1. Types (`src/engine/types.ts`)

```ts
export type MatchType = 'exact' | 'chunk' | 'affix' | 'fuzzy' | 'miss';

export interface TokenResult {
  source: string;                              // original word(s) as typed
  target: string | null;
  matchType: MatchType;
  correction?: { from: string; to: string };   // present iff matchType === 'fuzzy'
}

export interface TranslateOptions {
  rejectedCorrections?: string[];  // normalized source words the user chose to keep
}
```

`TranslationResult` keeps its shape (`method` stays `'phrase' | 'word-by-word'`,
`hasMisses` = any token with `matchType === 'miss'`). `translate()` gains an
optional trailing parameter:

```ts
translate(text: string, direction: Direction, lexicon: Lexicon, options?: TranslateOptions)
```

`Lexicon` gains two methods:

```ts
findWordCandidates(normalizedWord: string, direction: Direction): Promise<string[]>;
getAffixRules(): Promise<AffixRule[]>;
```

### 2. Chunk pass (`src/engine/engine.ts`)

Greedy longest-match, left to right over the token array:

- At position i, try window sizes n = min(6, tokensRemaining) down to 2.
- Look up `findPhrase(tokens[i..i+n].join(' '), direction)`.
- On hit: emit one TokenResult { source: original words joined, target: phrase
  translation, matchType: 'chunk' }, advance i by n.
- On no hit for any n: resolve tokens[i] as a single word (component 4), advance by 1.

Cost bound: at most 5 indexed exact SELECTs per token position; input is
debounced 250ms in the UI, fine at phone scale.

### 3. Affix module (`src/engine/affixes.ts`, new)

- `AffixRule { type: 'prefix' | 'infix' | 'suffix'; tl: string; ceb: string }`.
- Rules are data, not code: `data/affixes.csv` (columns `type,tl,ceb`), compiled
  into a new `affixes` table by `scripts/build-db.ts`, loaded once and memoized
  by `DictionaryRepo.getAffixRules()`.
- Resolution for direction tl-ceb (mirror for ceb-tl):
  1. For each rule whose tl form matches the word (prefix at start, suffix at
     end, infix after the first consonant cluster), strip it.
  2. Stripped root must be >= 3 letters AND found by `findWord` - otherwise the
     rule does not apply.
  3. On the first rule that yields a root hit, re-attach the rule's ceb form to
     the translated root and return it.
- Conservative by design: apply at most ONE rule (no stacking); first matching
  rule in table order wins (table ordered longest-affix-first at build time).
- Out of scope: reduplication ("magluluto"), affix stacking, infix placement
  beyond the first-consonant heuristic. Documented limitation.
- Initial `data/affixes.csv` drafted with ~15 common mappings (nag-, mag-, mi-/
  um-, gi-/-in-, i-, ka-, pag-, ma-, -an, -on, ...). The user (bilingual) reviews
  and corrects the file before release; build gate requires >= 10 rows.

### 4. Fuzzy module (`src/engine/fuzzy.ts`, new)

- Pure-TS Damerau-Levenshtein (insert, delete, replace, adjacent transpose).
  No new dependency.
- Candidate retrieval is SQL-side via `findWordCandidates`: same first letter,
  ABS(LENGTH(col) - LENGTH(word)) <= 2, LIMIT 50.
- Guardrails:
  - Only words >= 4 letters are fuzzy-corrected (never "ang", "sa", "ng").
  - Max distance: 1 for words of 4-5 letters, 2 for 6+.
  - Deterministic tie-break: lowest distance, then alphabetical.
  - Words listed in `options.rejectedCorrections` skip fuzzy entirely and
    become misses.
- A fuzzy hit returns the corrected word's translation plus
  `correction: { from: typedWord, to: matchedWord }`.

### 5. Word resolver order

exact -> affix -> fuzzy -> miss. Affix precedes fuzzy because a morphological
match on a verified root is more precise than an edit-distance guess. Combining
affix + fuzzy in one step (fuzzy on the stripped root) is out of scope.

### 6. Data layer (`src/data/dictionary.ts`, `scripts/build-db.ts`)

- `DictionaryRepo` implements the two new `Lexicon` methods:
  - `findWordCandidates`: the SQL above against the words table.
  - `getAffixRules`: SELECT from the new affixes table, memoized in the repo
    instance (rules never change at runtime).
- `build-db.ts`: new `affixes` table (`type TEXT, tl TEXT, ceb TEXT`), rows from
  `data/affixes.csv` ordered longest-affix-first, sanity gate >= 10 rows (same
  pattern as the >= 800 words / >= 150 phrases gates). Existing
  `eas-build-post-install` hook already regenerates the DB on EAS builders -
  no release-process change.

### 7. UI (`src/ui/ResultCard.tsx`, `app/(tabs)/index.tsx`)

- ResultCard: for each token with `matchType === 'fuzzy'`, render one correction
  line: `<from> -> <to>` with a tappable "keep original" affordance. Tapping
  calls a new `onRejectCorrection(sourceWord)` prop.
- Translate screen: holds `rejectedCorrections: string[]` state; appends on
  `onRejectCorrection` and re-translates; resets the list whenever the input
  text changes. Passes it via `TranslateOptions`.
- Unchanged: badges (METHOD_LABELS), miss rendering (gray/italic + note), speak/
  copy/favorite actions, history/favorites persistence, MicButton, settings.

## Error Handling

Engine stays pure and throw-free: resolver steps that fail simply fall through
to the next step; a word with no resolution is a miss, never an exception. DB
access errors propagate as today (SQLite async rejections surface via the
screen's existing cancelled-guard effect).

## Testing

Repo conventions apply: TDD, in-memory fake Lexicon (extend the existing one in
`src/engine/__tests__/engine.test.ts` with the two new methods), zero raw
non-ASCII bytes in source (\uXXXX escapes only), pristine test output.

Required coverage:

- fuzzy.ts: distance math incl. transposition; threshold-by-length; tie-break;
  min-length guard.
- affixes.ts: strip/re-attach in both directions; root-too-short rejection;
  root-not-in-dictionary rejection; one-rule-max; table-order precedence.
- engine.ts: whole-phrase still wins; chunk greedy longest-match (6->2 windows,
  adjacent chunks, chunk-then-word mixes); resolver precedence exact > affix >
  fuzzy; rejectedCorrections turns a fuzzy hit into a miss; method/badge logic;
  hasMisses; empty input.
- ResultCard: correction line renders for fuzzy tokens; tap fires
  onRejectCorrection; no correction line for exact/chunk/affix tokens.

## Non-Goals (v1.1)

- Reduplication and affix stacking
- Fuzzy matching on phrases (words only)
- Multiple senses per word / sense picker UI
- Any neural model work (separate v2 track, gated on the PC evaluation of NLLB)
- Dictionary data growth (parallel effort, not this engine change)

## Size Budget

Adds code and a small table only; app size impact approximately 0MB. Hard cap
150MB total remains in force (see docs/release-checklist.md).
