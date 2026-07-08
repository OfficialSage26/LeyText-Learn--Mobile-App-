# Offline Tagalog↔Bisaya Translator v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1 of an Android app that translates Tagalog↔Bisaya (Cebuano) fully offline using a bundled SQLite dictionary + phrase table, ready for Play Store release.

**Architecture:** Expo/React Native (TypeScript) app with expo-router tabs. A pure-TypeScript translation engine (`translate(text, direction, lexicon)`) tries exact phrase match, then word-by-word lookup, against a `Lexicon` interface. A prebuilt SQLite DB (compiled from CSVs in-repo by a Node script) implements the lexicon; a second runtime SQLite DB stores history/favorites. Engine strategy 3 (neural, v2) slots in later without UI changes.

**Tech Stack:** Expo SDK (latest), expo-router, expo-sqlite, expo-speech (TTS), expo-speech-recognition (voice input, dev build), expo-clipboard, @react-native-async-storage/async-storage, jest-expo (unit tests), better-sqlite3 + csv-parse + tsx (build script, dev-only), EAS Build.

**Spec:** `docs/superpowers/specs/2026-07-08-offline-tagalog-bisaya-translator-design.md`

## Global Constraints

- **Zero network calls in the app.** No fetch, no analytics, no remote assets. Airplane mode is the normal operating condition.
- **TypeScript strict mode** (template default — do not loosen).
- **Directions:** type `Direction = 'tl-ceb' | 'ceb-tl'` everywhere; never raw strings.
- **Honest labeling:** every result shows its method — `phrase` → "Exact match", `word-by-word` → "Approximate"; untranslated tokens render gray/italic.
- **Data source of truth:** `data/dictionary.csv` and `data/phrases.csv`; the SQLite file is always regenerated via `npm run build:db`, never hand-edited.
- **Phrase categories (exact ids):** `greetings`, `directions`, `food`, `shopping`, `emergencies`, `small_talk`.
- **Commits:** plain messages, **no Co-Authored-By or any co-author trailer** (user is sole author).
- **Install Expo-managed packages with `npx expo install <pkg>`** (not npm install) so versions match the SDK.
- **App identity:** name "LeyText Learn", Android package `com.ashly.leytextlearn`.
- Tasks 1–10 must remain testable in Expo Go; only Task 11 (voice input) onward requires a development build.

---

### Task 1: Scaffold Expo app with tabs and Jest

**Files:**
- Create: entire Expo project at repo root (via `create-expo-app`), then `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/phrasebook.tsx`, `app/(tabs)/saved.tsx`, `app/(tabs)/settings.tsx`, `app/_layout.tsx`, `src/ui/theme.ts`
- Modify: `package.json` (jest config + scripts)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: navigable 4-tab app shell; `theme` object `{ colors: { bg, card, text, muted, accent, accentSoft, danger } }` from `src/ui/theme.ts`; working `npm test`.

- [ ] **Step 1: Scaffold into the existing folder**

The repo root already contains `docs/` and `.git/`. Scaffold in place:

```powershell
npx create-expo-app@latest . --template default --yes
npm run reset-project
```

When `reset-project` asks, choose to **delete** the example files (or delete `app-example/` afterward if it was moved).

- [ ] **Step 2: Verify the app boots**

Run: `npx expo start`
Expected: QR code appears; opening in Expo Go (Android phone) or an emulator shows the blank template screen. Stop the server after confirming.

- [ ] **Step 3: Add Jest**

```powershell
npx expo install jest-expo jest @types/jest -- --save-dev
```

Add to `package.json` (top level):

```json
"scripts": {
  "test": "jest"
},
"jest": {
  "preset": "jest-expo",
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"
  ]
}
```

(Merge `test` into the existing `scripts` block; keep existing scripts.)

- [ ] **Step 4: Write a smoke test and run it**

Create `src/engine/__tests__/smoke.test.ts`:

```ts
test('jest runs', () => {
  expect(1 + 1).toBe(2);
});
```

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 5: Create the theme**

Create `src/ui/theme.ts`:

```ts
export const theme = {
  colors: {
    bg: '#F7F7F5',
    card: '#FFFFFF',
    text: '#1A1A1A',
    muted: '#8A8A8E',
    accent: '#0B6E4F',
    accentSoft: '#E6F2EE',
    danger: '#C0392B',
  },
} as const;
```

- [ ] **Step 6: Build the tab shell**

Create `app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
```

Create `app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { theme } from '../../src/ui/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.accent,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Translate',
          tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="phrasebook"
        options={{
          title: 'Phrasebook',
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color, size }) => <Ionicons name="star-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
```

Create each of `app/(tabs)/index.tsx`, `app/(tabs)/phrasebook.tsx`, `app/(tabs)/saved.tsx`, `app/(tabs)/settings.tsx` as a placeholder (change the label per file — Translate / Phrasebook / Saved / Settings):

```tsx
import { SafeAreaView, Text, StyleSheet } from 'react-native';
import { theme } from '../../src/ui/theme';

export default function Screen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Translate</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.text, marginTop: 8 },
});
```

- [ ] **Step 7: Verify tabs work**

Run: `npx expo start`
Expected: four tabs at the bottom, each showing its title. Stop the server.

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "Scaffold Expo app with 4-tab shell and Jest"
```

---

### Task 2: Text normalization module (TDD)

**Files:**
- Create: `src/engine/normalize.ts`
- Test: `src/engine/__tests__/normalize.test.ts`
- Delete: `src/engine/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `normalizeText(text: string): string` (lowercase, punctuation stripped except intra-word `'` and `-`, whitespace collapsed, trimmed) and `tokenize(text: string): string[]` (normalized then split on spaces; `[]` for empty).

- [ ] **Step 1: Write the failing tests**

Create `src/engine/__tests__/normalize.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `../normalize`.

- [ ] **Step 3: Implement**

Create `src/engine/normalize.ts`:

```ts
// Strip punctuation but keep straight apostrophes and hyphens (used inside
// Tagalog/Cebuano words like di'ba, araw-araw).
const PUNCTUATION = /[.,!?;:"“”‘’()[\]{}¿¡…–—/\\]/g;

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized === '' ? [] : normalized.split(' ');
}
```

- [ ] **Step 4: Run tests to verify they pass, delete smoke test**

Run: `npm test`
Expected: all normalize tests PASS. Then delete `src/engine/__tests__/smoke.test.ts` and run `npm test` again — still all green.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "Add text normalization and tokenizer with tests"
```

---

### Task 3: Translation engine core (TDD)

**Files:**
- Create: `src/engine/types.ts`, `src/engine/engine.ts`
- Test: `src/engine/__tests__/engine.test.ts`

**Interfaces:**
- Consumes: `normalizeText`, `tokenize` from `src/engine/normalize.ts`
- Produces (used by Tasks 5, 6, 8):

```ts
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
}
export async function translate(text: string, direction: Direction, lexicon: Lexicon): Promise<TranslationResult>;
```

- [ ] **Step 1: Write the types**

Create `src/engine/types.ts` with exactly the types shown in the Interfaces block above (everything except the `translate` function line).

- [ ] **Step 2: Write the failing tests**

Create `src/engine/__tests__/engine.test.ts`:

```ts
import { translate } from '../engine';
import type { Direction, Lexicon } from '../types';

function fakeLexicon(phrases: Record<string, string>, words: Record<string, string>): Lexicon {
  return {
    findPhrase: async (t: string, _d: Direction) => phrases[t] ?? null,
    findWord: async (w: string, _d: Direction) => words[w] ?? null,
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `../engine`.

- [ ] **Step 4: Implement**

Create `src/engine/engine.ts`:

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "Add translation engine with phrase and word-by-word strategies"
```

---

### Task 4: Seed data CSVs + SQLite build script

**Files:**
- Create: `data/dictionary.csv`, `data/phrases.csv`, `scripts/build-db.ts`
- Modify: `package.json` (script + devDeps), `.gitignore` (ignore `assets/db/`)
- Produces artifact: `assets/db/dictionary.db` (generated, git-ignored)

**Interfaces:**
- Consumes: `normalizeText` from `src/engine/normalize.ts`
- Produces: SQLite file `assets/db/dictionary.db` with schema:

```sql
CREATE TABLE words (
  id INTEGER PRIMARY KEY,
  tl TEXT NOT NULL,     -- normalized Tagalog form
  ceb TEXT NOT NULL,    -- normalized Cebuano form
  pos TEXT,
  note TEXT
);
CREATE INDEX idx_words_tl ON words(tl);
CREATE INDEX idx_words_ceb ON words(ceb);

CREATE TABLE phrases (
  id INTEGER PRIMARY KEY,
  tl TEXT NOT NULL,          -- display form
  ceb TEXT NOT NULL,         -- display form
  tl_norm TEXT NOT NULL,
  ceb_norm TEXT NOT NULL,
  category TEXT NOT NULL,    -- one of the six category ids
  pron TEXT                  -- plain-text pronunciation hint for the Cebuano side
);
CREATE INDEX idx_phrases_tl_norm ON phrases(tl_norm);
CREATE INDEX idx_phrases_ceb_norm ON phrases(ceb_norm);
CREATE INDEX idx_phrases_category ON phrases(category);
```

- [ ] **Step 1: Install build-script dev dependencies**

```powershell
npm install --save-dev better-sqlite3 @types/better-sqlite3 csv-parse tsx
```

- [ ] **Step 2: Create the CSV files with seed content**

`data/dictionary.csv` header + format (first rows shown; see acceptance below for volume):

```csv
tl,ceb,pos,note
saan,asa,adv,where
ako,ako,pron,I/me
ikaw,ikaw,pron,you
siya,siya,pron,he/she
kumain,mikaon,verb,ate
kain,kaon,verb,eat
maganda,gwapa,adj,beautiful (person)
mabuti,maayo,adj,good/fine
salamat,salamat,intj,thank you
oo,oo,intj,yes
hindi,dili,adv,no/not
gusto,gusto,verb,want/like
tubig,tubig,noun,water
bahay,balay,noun,house
palengke,merkado,noun,market
```

`data/phrases.csv` header + format (first rows shown):

```csv
category,tl,ceb,pron
greetings,Magandang umaga,Maayong buntag,ma-AH-yong BOON-tag
greetings,Magandang gabi,Maayong gabii,ma-AH-yong ga-BEE-i
greetings,Kumusta ka?,Kumusta ka?,koo-MOOS-ta ka
directions,Saan ang palengke?,Asa ang merkado?,AH-sa ang mer-KA-do
directions,Saan ang banyo?,Asa ang banyo?,AH-sa ang BAN-yo
food,Gutom na ako,Gigutom na ko,gi-GOO-tom na ko
food,Masarap ito,Lami ni,LA-mi ni
shopping,Magkano ito?,Tagpila ni?,tag-PEE-la ni
emergencies,Tulong!,Tabang!,TA-bang
small_talk,Anong pangalan mo?,Unsay imong ngalan?,OON-sai EE-mong NGA-lan
```

**Content acceptance criteria (the implementer authors these — both languages are well within an LLM's competence, and the user is a bilingual reviewer):**
- `dictionary.csv`: **≥ 800 rows** of high-frequency vocabulary (pronouns, question words, numbers, family, body, food, verbs of daily life, adjectives, time words, places). Include common spelling variants as separate rows (e.g. `po` and `ho`; `dito`/`rito`).
- `phrases.csv`: **≥ 150 rows** spread across all six categories (≥ 15 each), every row with a pronunciation hint.
- Where Tagalog and Cebuano share a word, still include the row (identity translations are correct and expected).

- [ ] **Step 3: Write the build script**

Create `scripts/build-db.ts`:

```ts
import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { normalizeText } from '../src/engine/normalize';

const OUT = 'assets/db/dictionary.db';

interface WordRow { tl: string; ceb: string; pos: string; note: string; }
interface PhraseRow { category: string; tl: string; ceb: string; pron: string; }

const CATEGORIES = new Set(['greetings', 'directions', 'food', 'shopping', 'emergencies', 'small_talk']);

function readCsv<T>(path: string): T[] {
  return parse(readFileSync(path, 'utf8'), { columns: true, skip_empty_lines: true, trim: true }) as T[];
}

mkdirSync('assets/db', { recursive: true });
rmSync(OUT, { force: true });
const db = new Database(OUT);

db.exec(`
  CREATE TABLE words (
    id INTEGER PRIMARY KEY,
    tl TEXT NOT NULL,
    ceb TEXT NOT NULL,
    pos TEXT,
    note TEXT
  );
  CREATE INDEX idx_words_tl ON words(tl);
  CREATE INDEX idx_words_ceb ON words(ceb);
  CREATE TABLE phrases (
    id INTEGER PRIMARY KEY,
    tl TEXT NOT NULL,
    ceb TEXT NOT NULL,
    tl_norm TEXT NOT NULL,
    ceb_norm TEXT NOT NULL,
    category TEXT NOT NULL,
    pron TEXT
  );
  CREATE INDEX idx_phrases_tl_norm ON phrases(tl_norm);
  CREATE INDEX idx_phrases_ceb_norm ON phrases(ceb_norm);
  CREATE INDEX idx_phrases_category ON phrases(category);
`);

const words = readCsv<WordRow>('data/dictionary.csv');
const insertWord = db.prepare('INSERT INTO words (tl, ceb, pos, note) VALUES (?, ?, ?, ?)');
for (const w of words) {
  const tl = normalizeText(w.tl);
  const ceb = normalizeText(w.ceb);
  if (!tl || !ceb) throw new Error(`Bad word row: ${JSON.stringify(w)}`);
  insertWord.run(tl, ceb, w.pos || null, w.note || null);
}

const phrases = readCsv<PhraseRow>('data/phrases.csv');
const insertPhrase = db.prepare(
  'INSERT INTO phrases (tl, ceb, tl_norm, ceb_norm, category, pron) VALUES (?, ?, ?, ?, ?, ?)',
);
for (const p of phrases) {
  if (!CATEGORIES.has(p.category)) throw new Error(`Unknown category "${p.category}" in: ${p.tl}`);
  insertPhrase.run(p.tl, p.ceb, normalizeText(p.tl), normalizeText(p.ceb), p.category, p.pron || null);
}

db.close();

const counts = { words: words.length, phrases: phrases.length };
console.log(`Built ${OUT}: ${counts.words} words, ${counts.phrases} phrases`);
if (counts.words < 800 || counts.phrases < 150) {
  console.error('FAIL: below minimum volume (need >=800 words, >=150 phrases)');
  process.exit(1);
}
```

Add to `package.json` scripts: `"build:db": "tsx scripts/build-db.ts"`.
Add to `.gitignore`: `assets/db/`.

- [ ] **Step 4: Build and verify**

Run: `npm run build:db`
Expected: `Built assets/db/dictionary.db: <N> words, <M> phrases` with N ≥ 800, M ≥ 150, exit code 0.

Spot-check with:

```powershell
node -e "const d=require('better-sqlite3')('assets/db/dictionary.db');console.log(d.prepare('SELECT ceb FROM words WHERE tl=?').get('saan'));console.log(d.prepare('SELECT category,COUNT(*) c FROM phrases GROUP BY category').all())"
```

Expected: `{ ceb: 'asa' }` and six categories each with count ≥ 15.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "Add seed dictionary/phrase data and SQLite build script"
```

---

### Task 5: SQLite lexicon adapter + app DB wiring

**Files:**
- Create: `src/data/dictionary.ts`, `src/data/useDictionary.ts`, `metro.config.js`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `Lexicon`, `Direction` from `src/engine/types.ts`; `assets/db/dictionary.db` from Task 4.
- Produces (used by Tasks 6, 7):

```ts
export interface PhraseEntry { id: number; tl: string; ceb: string; category: string; pron: string | null; }
export class DictionaryRepo implements Lexicon {
  findPhrase(normalizedText: string, direction: Direction): Promise<string | null>;
  findWord(normalizedWord: string, direction: Direction): Promise<string | null>;
  findSuggestions(prefix: string, direction: Direction, limit?: number): Promise<string[]>;
  getCategoryCounts(): Promise<{ category: string; count: number }[]>;
  getPhrasesByCategory(category: string): Promise<PhraseEntry[]>;
  searchPhrases(query: string): Promise<PhraseEntry[]>;
}
// hook
export function useDictionary(): DictionaryRepo;
```

- [ ] **Step 1: Make Metro bundle .db assets**

Run: `npx expo customize metro.config.js`, then edit `metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('db');

module.exports = config;
```

- [ ] **Step 2: Install expo-sqlite and expo-asset**

```powershell
npx expo install expo-sqlite expo-asset
```

- [ ] **Step 3: Implement the repo**

Create `src/data/dictionary.ts`:

```ts
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Direction, Lexicon } from '../engine/types';

export interface PhraseEntry {
  id: number;
  tl: string;
  ceb: string;
  category: string;
  pron: string | null;
}

export class DictionaryRepo implements Lexicon {
  constructor(private readonly db: SQLiteDatabase) {}

  async findPhrase(normalizedText: string, direction: Direction): Promise<string | null> {
    const sql =
      direction === 'tl-ceb'
        ? 'SELECT ceb AS out FROM phrases WHERE tl_norm = ? LIMIT 1'
        : 'SELECT tl AS out FROM phrases WHERE ceb_norm = ? LIMIT 1';
    const row = await this.db.getFirstAsync<{ out: string }>(sql, normalizedText);
    return row?.out ?? null;
  }

  async findWord(normalizedWord: string, direction: Direction): Promise<string | null> {
    const sql =
      direction === 'tl-ceb'
        ? 'SELECT ceb AS out FROM words WHERE tl = ? LIMIT 1'
        : 'SELECT tl AS out FROM words WHERE ceb = ? LIMIT 1';
    const row = await this.db.getFirstAsync<{ out: string }>(sql, normalizedWord);
    return row?.out ?? null;
  }

  async findSuggestions(prefix: string, direction: Direction, limit = 3): Promise<string[]> {
    const col = direction === 'tl-ceb' ? 'tl' : 'ceb';
    const rows = await this.db.getAllAsync<{ w: string }>(
      `SELECT DISTINCT ${col} AS w FROM words WHERE ${col} LIKE ? ORDER BY ${col} LIMIT ?`,
      `${prefix}%`,
      limit,
    );
    return rows.map((r) => r.w);
  }

  async getCategoryCounts(): Promise<{ category: string; count: number }[]> {
    return this.db.getAllAsync(
      'SELECT category, COUNT(*) AS count FROM phrases GROUP BY category ORDER BY category',
    );
  }

  async getPhrasesByCategory(category: string): Promise<PhraseEntry[]> {
    return this.db.getAllAsync(
      'SELECT id, tl, ceb, category, pron FROM phrases WHERE category = ? ORDER BY tl',
      category,
    );
  }

  async searchPhrases(query: string): Promise<PhraseEntry[]> {
    const q = `%${query.toLowerCase()}%`;
    return this.db.getAllAsync(
      'SELECT id, tl, ceb, category, pron FROM phrases WHERE tl_norm LIKE ? OR ceb_norm LIKE ? ORDER BY tl LIMIT 50',
      q,
      q,
    );
  }
}
```

Create `src/data/useDictionary.ts`:

```ts
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';
import { DictionaryRepo } from './dictionary';

export function useDictionary(): DictionaryRepo {
  const db = useSQLiteContext();
  return useMemo(() => new DictionaryRepo(db), [db]);
}
```

- [ ] **Step 4: Wire the provider**

Replace `app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  return (
    <Suspense
      fallback={
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      }
    >
      <SQLiteProvider
        databaseName="dictionary.db"
        assetSource={{ assetId: require('../assets/db/dictionary.db') }}
        useSuspense
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SQLiteProvider>
    </Suspense>
  );
}
```

- [ ] **Step 5: Verify on device**

Temporarily add to `app/(tabs)/index.tsx` inside the component:

```tsx
const dict = useDictionary();
useEffect(() => {
  dict.findWord('saan', 'tl-ceb').then((r) => console.log('LOOKUP saan →', r));
}, [dict]);
```

Run: `npx expo start`, open the app.
Expected: terminal logs `LOOKUP saan → asa`. Remove the temporary code after verifying.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "Bundle dictionary SQLite and add lexicon adapter"
```

---

### Task 6: Translate screen

**Files:**
- Create: `src/ui/ResultCard.tsx`, `src/ui/DirectionToggle.tsx`, `src/ui/labels.ts`
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `translate` (Task 3), `useDictionary`/`DictionaryRepo` (Task 5), `theme` (Task 1).
- Produces: `<DirectionToggle value onChange />`, `<ResultCard result suggestions onToggleFavorite? isFavorite? />` (favorite props unused until Task 8; TTS button added in Task 9); `DIRECTION_LABELS: Record<Direction, { from: string; to: string }>` in `src/ui/labels.ts`.

- [ ] **Step 1: Install clipboard**

```powershell
npx expo install expo-clipboard
```

- [ ] **Step 2: Create labels**

Create `src/ui/labels.ts`:

```ts
import type { Direction } from '../engine/types';

export const DIRECTION_LABELS: Record<Direction, { from: string; to: string }> = {
  'tl-ceb': { from: 'Tagalog', to: 'Bisaya' },
  'ceb-tl': { from: 'Bisaya', to: 'Tagalog' },
};

export const METHOD_LABELS = {
  phrase: 'Exact match',
  'word-by-word': 'Approximate',
} as const;
```

- [ ] **Step 3: Create DirectionToggle**

Create `src/ui/DirectionToggle.tsx`:

```tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Direction } from '../engine/types';
import { DIRECTION_LABELS } from './labels';
import { theme } from './theme';

export function DirectionToggle({
  value,
  onChange,
}: {
  value: Direction;
  onChange: (d: Direction) => void;
}) {
  const labels = DIRECTION_LABELS[value];
  return (
    <View style={styles.row}>
      <Text style={styles.lang}>{labels.from}</Text>
      <Pressable
        accessibilityLabel="Swap languages"
        onPress={() => onChange(value === 'tl-ceb' ? 'ceb-tl' : 'tl-ceb')}
        style={styles.swap}
      >
        <Ionicons name="swap-horizontal" size={20} color={theme.colors.accent} />
      </Pressable>
      <Text style={styles.lang}>{labels.to}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginVertical: 12 },
  lang: { fontSize: 16, fontWeight: '600', color: theme.colors.text, width: 90, textAlign: 'center' },
  swap: { backgroundColor: theme.colors.accentSoft, borderRadius: 20, padding: 8 },
});
```

- [ ] **Step 4: Create ResultCard**

Create `src/ui/ResultCard.tsx`:

```tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TranslationResult } from '../engine/types';
import { METHOD_LABELS } from './labels';
import { theme } from './theme';

export function ResultCard({
  result,
  suggestions,
  isFavorite,
  onToggleFavorite,
}: {
  result: TranslationResult;
  suggestions: string[];
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  if (result.output === '') return null;
  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <Text style={[styles.badge, result.method === 'phrase' ? styles.badgeExact : styles.badgeApprox]}>
          {METHOD_LABELS[result.method]}
        </Text>
      </View>
      {result.method === 'phrase' ? (
        <Text style={styles.output}>{result.output}</Text>
      ) : (
        <Text style={styles.output}>
          {result.tokens.map((t, i) => (
            <Text key={i} style={t.target === null ? styles.miss : undefined}>
              {(i > 0 ? ' ' : '') + (t.target ?? t.source)}
            </Text>
          ))}
        </Text>
      )}
      {result.hasMisses && (
        <Text style={styles.note}>Gray words were not found in the dictionary.</Text>
      )}
      {suggestions.length > 0 && (
        <Text style={styles.note}>Did you mean: {suggestions.join(', ')}?</Text>
      )}
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Copy translation"
          onPress={() => Clipboard.setStringAsync(result.output)}
          style={styles.action}
        >
          <Ionicons name="copy-outline" size={20} color={theme.colors.accent} />
        </Pressable>
        {onToggleFavorite && (
          <Pressable accessibilityLabel="Favorite" onPress={onToggleFavorite} style={styles.action}>
            <Ionicons
              name={isFavorite ? 'star' : 'star-outline'}
              size={20}
              color={theme.colors.accent}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 16, marginTop: 16 },
  badgeRow: { flexDirection: 'row', marginBottom: 8 },
  badge: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  badgeExact: { backgroundColor: theme.colors.accentSoft, color: theme.colors.accent },
  badgeApprox: { backgroundColor: '#FFF3E0', color: '#B26A00' },
  output: { fontSize: 22, color: theme.colors.text, lineHeight: 30 },
  miss: { color: theme.colors.muted, fontStyle: 'italic' },
  note: { fontSize: 13, color: theme.colors.muted, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  action: { backgroundColor: theme.colors.accentSoft, borderRadius: 20, padding: 10 },
});
```

- [ ] **Step 5: Build the screen**

Replace `app/(tabs)/index.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput } from 'react-native';
import { translate } from '../../src/engine/engine';
import type { Direction, TranslationResult } from '../../src/engine/types';
import { useDictionary } from '../../src/data/useDictionary';
import { DirectionToggle } from '../../src/ui/DirectionToggle';
import { ResultCard } from '../../src/ui/ResultCard';
import { theme } from '../../src/ui/theme';

export default function TranslateScreen() {
  const dict = useDictionary();
  const [direction, setDirection] = useState<Direction>('tl-ceb');
  const [text, setText] = useState('');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (text.trim() === '') {
        setResult(null);
        setSuggestions([]);
        return;
      }
      const r = await translate(text, direction, dict);
      setResult(r);
      // Offer near-matches only for a single unknown word.
      if (r.method === 'word-by-word' && r.tokens.length === 1 && r.hasMisses) {
        setSuggestions(await dict.findSuggestions(r.tokens[0].source.slice(0, 3), direction));
      } else {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [text, direction, dict]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Text style={styles.title}>Translate</Text>
        <DirectionToggle value={direction} onChange={setDirection} />
        <TextInput
          style={styles.input}
          multiline
          placeholder={direction === 'tl-ceb' ? 'Isulat ang Tagalog dito…' : 'Isulat ang Bisaya dinhi…'}
          placeholderTextColor={theme.colors.muted}
          value={text}
          onChangeText={setText}
          autoCorrect={false}
        />
        {result && <ResultCard result={result} suggestions={suggestions} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.text, marginTop: 8 },
  input: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 16,
    fontSize: 18,
    minHeight: 110,
    textAlignVertical: 'top',
    color: theme.colors.text,
  },
});
```

- [ ] **Step 6: Verify manually**

Run: `npx expo start`, on the phone:
- Type `Saan ang palengke?` (TL→CEB) → "Asa ang merkado?" with **Exact match** badge (if the phrase row exists) — also try a phrase you know is in `phrases.csv`.
- Type a multi-word non-phrase sentence → word-by-word output, **Approximate** badge, unknown words gray/italic with the note.
- Swap direction and confirm Bisaya→Tagalog lookups work.
- Copy button puts the output on the clipboard.

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "Add translate screen with live offline translation"
```

---

### Task 7: Phrasebook screens

**Files:**
- Create: `src/ui/categories.ts`, `app/category/[name].tsx`
- Modify: `app/(tabs)/phrasebook.tsx`, `app/_layout.tsx` (register route)

**Interfaces:**
- Consumes: `useDictionary` (`getCategoryCounts`, `getPhrasesByCategory`, `searchPhrases`), `theme`.
- Produces: `CATEGORY_META: Record<string, { label: string; emoji: string }>` in `src/ui/categories.ts` (keys are the six category ids).

- [ ] **Step 1: Category metadata**

Create `src/ui/categories.ts`:

```ts
export const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  greetings: { label: 'Greetings', emoji: '👋' },
  directions: { label: 'Directions', emoji: '🧭' },
  food: { label: 'Food', emoji: '🍚' },
  shopping: { label: 'Shopping', emoji: '🛒' },
  emergencies: { label: 'Emergencies', emoji: '🚨' },
  small_talk: { label: 'Small Talk', emoji: '💬' },
};
```

- [ ] **Step 2: Category grid + search**

Replace `app/(tabs)/phrasebook.tsx`:

```tsx
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PhraseEntry } from '../../src/data/dictionary';
import { useDictionary } from '../../src/data/useDictionary';
import { CATEGORY_META } from '../../src/ui/categories';
import { theme } from '../../src/ui/theme';

export default function PhrasebookScreen() {
  const dict = useDictionary();
  const [counts, setCounts] = useState<{ category: string; count: number }[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PhraseEntry[]>([]);

  useEffect(() => {
    dict.getCategoryCounts().then(setCounts);
  }, [dict]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      setResults(query.trim() === '' ? [] : await dict.searchPhrases(query.trim()));
    }, 200);
    return () => clearTimeout(handle);
  }, [query, dict]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Phrasebook</Text>
      <TextInput
        style={styles.search}
        placeholder="Search phrases…"
        placeholderTextColor={theme.colors.muted}
        value={query}
        onChangeText={setQuery}
      />
      {query.trim() !== '' ? (
        <FlatList
          data={results}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => (
            <View style={styles.phraseCard}>
              <Text style={styles.tl}>{item.tl}</Text>
              <Text style={styles.ceb}>{item.ceb}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No phrases found.</Text>}
        />
      ) : (
        <FlatList
          data={counts}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ gap: 12 }}
          keyExtractor={(c) => c.category}
          renderItem={({ item }) => {
            const meta = CATEGORY_META[item.category] ?? { label: item.category, emoji: '📖' };
            return (
              <Link href={{ pathname: '/category/[name]', params: { name: item.category } }} asChild>
                <Pressable style={styles.catCard}>
                  <Text style={styles.catEmoji}>{meta.emoji}</Text>
                  <Text style={styles.catLabel}>{meta.label}</Text>
                  <Text style={styles.catCount}>{item.count} phrases</Text>
                </Pressable>
              </Link>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.text, marginTop: 8, marginBottom: 12 },
  search: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 12, fontSize: 16, marginBottom: 16, color: theme.colors.text },
  catCard: { flex: 1, backgroundColor: theme.colors.card, borderRadius: 16, padding: 16 },
  catEmoji: { fontSize: 28 },
  catLabel: { fontSize: 16, fontWeight: '600', color: theme.colors.text, marginTop: 8 },
  catCount: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  phraseCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  tl: { fontSize: 16, color: theme.colors.text, fontWeight: '600' },
  ceb: { fontSize: 16, color: theme.colors.accent, marginTop: 4 },
  empty: { color: theme.colors.muted, textAlign: 'center', marginTop: 24 },
});
```

- [ ] **Step 3: Category detail screen**

Register the route — in `app/_layout.tsx` add inside the `<Stack>`:

```tsx
<Stack.Screen name="category/[name]" options={{ headerShown: true, headerBackTitle: 'Back' }} />
```

Create `app/category/[name].tsx`:

```tsx
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PhraseEntry } from '../../src/data/dictionary';
import { useDictionary } from '../../src/data/useDictionary';
import { CATEGORY_META } from '../../src/ui/categories';
import { theme } from '../../src/ui/theme';

export default function CategoryScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const dict = useDictionary();
  const [phrases, setPhrases] = useState<PhraseEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const meta = CATEGORY_META[name] ?? { label: name, emoji: '📖' };

  useEffect(() => {
    dict.getPhrasesByCategory(name).then(setPhrases);
  }, [dict, name]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `${meta.emoji} ${meta.label}` }} />
      <FlatList
        data={phrases}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => setExpanded(expanded === item.id ? null : item.id)}
          >
            <Text style={styles.tl}>{item.tl}</Text>
            <Text style={styles.ceb}>{item.ceb}</Text>
            {expanded === item.id && item.pron && (
              <Text style={styles.pron}>🔉 {item.pron}</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  card: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 14 },
  tl: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  ceb: { fontSize: 16, color: theme.colors.accent, marginTop: 4 },
  pron: { fontSize: 14, color: theme.colors.muted, marginTop: 8 },
});
```

- [ ] **Step 4: Verify manually**

Run: `npx expo start`.
Expected: Phrasebook tab shows a 2-column category grid with counts; tapping a category opens its phrase list with a proper header; tapping a phrase expands the pronunciation hint; search filters across all phrases.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "Add phrasebook with categories, detail view, and search"
```

---

### Task 8: History & favorites

**Files:**
- Create: `src/data/userDb.ts`, `src/data/userRepo.ts`
- Modify: `app/(tabs)/index.tsx` (auto-save + star), `app/(tabs)/saved.tsx`

**Interfaces:**
- Consumes: `Direction`, `TranslationResult` (Task 3); `ResultCard`'s `isFavorite`/`onToggleFavorite` props (Task 6).
- Produces (used by Tasks 9, 10):

```ts
export interface SavedEntry { id: number; input: string; output: string; direction: Direction; createdAt: number; }
export function getUserDb(): Promise<SQLiteDatabase>;
export class UserRepo {
  static create(): Promise<UserRepo>;
  addHistory(r: { input: string; output: string; direction: Direction; method: string }): Promise<void>; // prunes to 200
  getHistory(): Promise<SavedEntry[]>;
  clearHistory(): Promise<void>;
  toggleFavorite(input: string, output: string, direction: Direction): Promise<boolean>; // returns new state
  isFavorite(input: string, direction: Direction): Promise<boolean>;
  getFavorites(): Promise<SavedEntry[]>;
}
```

- [ ] **Step 1: User DB module**

Create `src/data/userDb.ts`:

```ts
import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getUserDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('userdata.db').then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          input TEXT NOT NULL,
          output TEXT NOT NULL,
          direction TEXT NOT NULL,
          method TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          input TEXT NOT NULL,
          output TEXT NOT NULL,
          direction TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          UNIQUE(input, direction)
        );
      `);
      return db;
    });
  }
  return dbPromise;
}
```

- [ ] **Step 2: User repo**

Create `src/data/userRepo.ts`:

```ts
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Direction } from '../engine/types';
import { getUserDb } from './userDb';

export interface SavedEntry {
  id: number;
  input: string;
  output: string;
  direction: Direction;
  createdAt: number;
}

const HISTORY_LIMIT = 200;

export class UserRepo {
  private constructor(private readonly db: SQLiteDatabase) {}

  static async create(): Promise<UserRepo> {
    return new UserRepo(await getUserDb());
  }

  async addHistory(r: { input: string; output: string; direction: Direction; method: string }): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO history (input, output, direction, method, created_at) VALUES (?, ?, ?, ?, ?)',
      r.input, r.output, r.direction, r.method, Date.now(),
    );
    await this.db.runAsync(
      `DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY id DESC LIMIT ${HISTORY_LIMIT})`,
    );
  }

  async getHistory(): Promise<SavedEntry[]> {
    return this.db.getAllAsync(
      'SELECT id, input, output, direction, created_at AS createdAt FROM history ORDER BY id DESC',
    );
  }

  async clearHistory(): Promise<void> {
    await this.db.runAsync('DELETE FROM history');
  }

  async toggleFavorite(input: string, output: string, direction: Direction): Promise<boolean> {
    const existing = await this.db.getFirstAsync<{ id: number }>(
      'SELECT id FROM favorites WHERE input = ? AND direction = ?', input, direction,
    );
    if (existing) {
      await this.db.runAsync('DELETE FROM favorites WHERE id = ?', existing.id);
      return false;
    }
    await this.db.runAsync(
      'INSERT INTO favorites (input, output, direction, created_at) VALUES (?, ?, ?, ?)',
      input, output, direction, Date.now(),
    );
    return true;
  }

  async isFavorite(input: string, direction: Direction): Promise<boolean> {
    const row = await this.db.getFirstAsync(
      'SELECT id FROM favorites WHERE input = ? AND direction = ?', input, direction,
    );
    return row != null;
  }

  async getFavorites(): Promise<SavedEntry[]> {
    return this.db.getAllAsync(
      'SELECT id, input, output, direction, created_at AS createdAt FROM favorites ORDER BY id DESC',
    );
  }
}
```

- [ ] **Step 3: Hook into the Translate screen**

In `app/(tabs)/index.tsx`:
- Add state: `const [repo, setRepo] = useState<UserRepo | null>(null);` and `const [isFav, setIsFav] = useState(false);` with `useEffect(() => { UserRepo.create().then(setRepo); }, []);`
- In the debounced effect, after `setResult(r)`: save to history only for "settled" input (add a second timer or save on result with 1.5s debounce). Implement as a separate effect:

```tsx
useEffect(() => {
  if (!repo || !result || result.output === '') return;
  const handle = setTimeout(() => {
    repo.addHistory({ input: result.input, output: result.output, direction: result.direction, method: result.method });
  }, 1500);
  const favCheck = repo.isFavorite(result.input, result.direction).then(setIsFav);
  return () => clearTimeout(handle);
}, [repo, result]);
```

- Pass to `ResultCard`:

```tsx
<ResultCard
  result={result}
  suggestions={suggestions}
  isFavorite={isFav}
  onToggleFavorite={async () => {
    if (!repo || !result) return;
    setIsFav(await repo.toggleFavorite(result.input, result.output, result.direction));
  }}
/>
```

- [ ] **Step 4: Saved screen**

Replace `app/(tabs)/saved.tsx`:

```tsx
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { SavedEntry } from '../../src/data/userRepo';
import { UserRepo } from '../../src/data/userRepo';
import { DIRECTION_LABELS } from '../../src/ui/labels';
import { theme } from '../../src/ui/theme';

export default function SavedScreen() {
  const [tab, setTab] = useState<'history' | 'favorites'>('history');
  const [entries, setEntries] = useState<SavedEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      UserRepo.create().then(async (repo) => {
        setEntries(tab === 'history' ? await repo.getHistory() : await repo.getFavorites());
      });
    }, [tab]),
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Saved</Text>
      <View style={styles.tabs}>
        {(['history', 'favorites'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'history' ? 'History' : 'Favorites'}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={entries}
        keyExtractor={(e) => `${tab}-${e.id}`}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.dir}>
              {DIRECTION_LABELS[item.direction].from} → {DIRECTION_LABELS[item.direction].to}
            </Text>
            <Text style={styles.input}>{item.input}</Text>
            <Text style={styles.output}>{item.output}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {tab === 'history' ? 'No translations yet.' : 'No favorites yet — tap the star on a translation.'}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.text, marginTop: 8, marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.card },
  tabActive: { backgroundColor: theme.colors.accent },
  tabText: { color: theme.colors.text, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  card: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 14 },
  dir: { fontSize: 12, color: theme.colors.muted, marginBottom: 4 },
  input: { fontSize: 15, color: theme.colors.text },
  output: { fontSize: 16, color: theme.colors.accent, marginTop: 4, fontWeight: '600' },
  empty: { color: theme.colors.muted, textAlign: 'center', marginTop: 32 },
});
```

- [ ] **Step 5: Verify manually**

Run: `npx expo start`.
Expected: translate a few things, wait ~2s each; Saved → History lists them (newest first). Star a result; Saved → Favorites shows it; starring again removes it. Kill and reopen the app — data persists.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "Add on-device history and favorites"
```

---

### Task 9: Text-to-speech

**Files:**
- Create: `src/ui/SpeakButton.tsx`, `src/data/settings.ts`
- Modify: `src/ui/ResultCard.tsx` (add speak button), `app/category/[name].tsx` (speak on expanded phrase)

**Interfaces:**
- Consumes: `theme`; device TTS via `expo-speech`.
- Produces:

```ts
// src/data/settings.ts (AsyncStorage-backed; also used by Task 10)
export interface Settings { defaultDirection: Direction; ttsRate: number; bisayaVoiceNoticeShown: boolean; }
export function getSettings(): Promise<Settings>;
export function saveSettings(patch: Partial<Settings>): Promise<void>;
// src/ui/SpeakButton.tsx
export function SpeakButton({ text }: { text: string }): JSX.Element | null; // renders null if no Filipino voice
```

- [ ] **Step 1: Install packages**

```powershell
npx expo install expo-speech @react-native-async-storage/async-storage
```

- [ ] **Step 2: Settings module**

Create `src/data/settings.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Direction } from '../engine/types';

export interface Settings {
  defaultDirection: Direction;
  ttsRate: number;
  bisayaVoiceNoticeShown: boolean;
}

const KEY = 'settings.v1';
const DEFAULTS: Settings = { defaultDirection: 'tl-ceb', ttsRate: 0.9, bisayaVoiceNoticeShown: false };

export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
}
```

- [ ] **Step 3: SpeakButton**

Create `src/ui/SpeakButton.tsx`:

```tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { getSettings, saveSettings } from '../data/settings';
import { theme } from './theme';

let filVoiceAvailable: boolean | null = null;

export function SpeakButton({ text }: { text: string }) {
  const [available, setAvailable] = useState<boolean>(filVoiceAvailable ?? false);

  useEffect(() => {
    if (filVoiceAvailable !== null) return;
    Speech.getAvailableVoicesAsync().then((voices) => {
      filVoiceAvailable = voices.some((v) => v.language.toLowerCase().startsWith('fil'));
      setAvailable(filVoiceAvailable);
    });
  }, []);

  if (!available) return null;

  const speak = async () => {
    const settings = await getSettings();
    if (!settings.bisayaVoiceNoticeShown) {
      Alert.alert(
        'About audio',
        'Audio uses the Filipino (Tagalog) voice for both languages, so Bisaya pronunciation is approximate.',
      );
      await saveSettings({ bisayaVoiceNoticeShown: true });
    }
    Speech.stop();
    Speech.speak(text, { language: 'fil-PH', rate: settings.ttsRate });
  };

  return (
    <Pressable accessibilityLabel="Speak translation" onPress={speak} style={styles.action}>
      <Ionicons name="volume-high-outline" size={20} color={theme.colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { backgroundColor: theme.colors.accentSoft, borderRadius: 20, padding: 10 },
});
```

- [ ] **Step 4: Wire into ResultCard and category screen**

In `src/ui/ResultCard.tsx`, import `SpeakButton` and add `<SpeakButton text={result.output} />` as the first child of the `actions` row.

In `app/category/[name].tsx`, when a phrase is expanded, render below the pronunciation:

```tsx
{expanded === item.id && (
  <View style={{ flexDirection: 'row', marginTop: 8 }}>
    <SpeakButton text={item.ceb} />
  </View>
)}
```

(import `SpeakButton`; keep the existing pron text).

- [ ] **Step 5: Verify manually**

Run: `npx expo start` on a phone with Google TTS.
Expected: speaker icon appears on results and expanded phrases; first tap shows the one-time notice, then speaks; subsequent taps speak immediately. On a device without a Filipino voice the icon simply doesn't render.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "Add text-to-speech with one-time Bisaya voice notice"
```

---

### Task 10: Settings screen

**Files:**
- Modify: `app/(tabs)/settings.tsx`, `app/(tabs)/index.tsx` (respect default direction)

**Interfaces:**
- Consumes: `getSettings`/`saveSettings` (Task 9), `UserRepo.clearHistory` (Task 8), `DIRECTION_LABELS` (Task 6), `theme`.
- Produces: nothing new (leaf screen).

- [ ] **Step 1: Build the screen**

Replace `app/(tabs)/settings.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getSettings, saveSettings, type Settings } from '../../src/data/settings';
import { UserRepo } from '../../src/data/userRepo';
import type { Direction } from '../../src/engine/types';
import { DIRECTION_LABELS } from '../../src/ui/labels';
import { theme } from '../../src/ui/theme';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return null;

  const setDirection = async (d: Direction) => {
    await saveSettings({ defaultDirection: d });
    setSettings({ ...settings, defaultDirection: d });
  };

  const clearHistory = () => {
    Alert.alert('Clear history?', 'This removes all past translations (favorites are kept).', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => (await UserRepo.create()).clearHistory(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.section}>Default direction</Text>
        {(['tl-ceb', 'ceb-tl'] as const).map((d) => (
          <Pressable key={d} style={styles.row} onPress={() => setDirection(d)}>
            <Text style={styles.rowText}>
              {DIRECTION_LABELS[d].from} → {DIRECTION_LABELS[d].to}
            </Text>
            <Text style={styles.check}>{settings.defaultDirection === d ? '✓' : ''}</Text>
          </Pressable>
        ))}

        <Text style={styles.section}>Data</Text>
        <Pressable style={styles.row} onPress={clearHistory}>
          <Text style={[styles.rowText, { color: theme.colors.danger }]}>Clear history</Text>
        </Pressable>

        <Text style={styles.section}>About</Text>
        <View style={styles.about}>
          <Text style={styles.aboutText}>
            LeyText Learn translates Tagalog ↔ Bisaya (Cebuano) fully offline. Nothing you type ever
            leaves your phone — the app makes no network connections at all.
          </Text>
          <Text style={styles.aboutText}>
            Word-by-word results are approximate; exact matches come from a curated phrasebook.
          </Text>
          <Text style={styles.aboutText}>
            Dictionary data compiled from community sources including Wiktionary (CC BY-SA) and
            Tatoeba (CC BY), with original curated content. Corrections welcome.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.text, marginTop: 8, marginBottom: 8 },
  section: { fontSize: 13, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  row: {
    backgroundColor: theme.colors.card, borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  rowText: { fontSize: 16, color: theme.colors.text },
  check: { fontSize: 16, color: theme.colors.accent, fontWeight: '700' },
  about: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 14, gap: 8 },
  aboutText: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
});
```

- [ ] **Step 2: Respect default direction on the Translate screen**

In `app/(tabs)/index.tsx`, initialize direction from settings:

```tsx
useEffect(() => {
  getSettings().then((s) => setDirection(s.defaultDirection));
}, []);
```

(import `getSettings`; runs once on mount — manual toggles still work afterward.)

- [ ] **Step 3: Verify manually**

Run: `npx expo start`.
Expected: changing default direction persists across app restarts and the Translate tab opens in that direction; Clear history empties the History tab but keeps Favorites; About text renders with credits.

- [ ] **Step 4: Commit**

```powershell
git add -A
git commit -m "Add settings screen with default direction, clear history, and about"
```

---

### Task 11: Voice input (development build required)

**Files:**
- Create: `src/ui/MicButton.tsx`, `eas.json`
- Modify: `app.json` (plugin + permissions), `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: Translate screen's `setText` (Task 6).
- Produces: `<MicButton onTranscript={(text: string) => void} enabled={boolean} />` — shown only for direction `tl-ceb`.

**Note:** `expo-speech-recognition` is a native module — Expo Go no longer works after this task; use the dev build for all subsequent manual testing.

- [ ] **Step 1: Install and configure**

```powershell
npx expo install expo-speech-recognition expo-dev-client
```

In `app.json`, add to `expo.plugins`:

```json
["expo-speech-recognition", { "microphonePermission": "Allow LeyText Learn to use the microphone for voice input." }]
```

- [ ] **Step 2: MicButton component**

Create `src/ui/MicButton.tsx`:

```tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

export function MicButton({ onTranscript, enabled }: { onTranscript: (t: string) => void; enabled: boolean }) {
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    setAvailable(ExpoSpeechRecognitionModule.isRecognitionAvailable());
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) onTranscript(transcript);
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    if (event.error === 'network') {
      Alert.alert(
        'Offline voice input unavailable',
        'Your phone needs the offline Tagalog language pack. Install it via phone Settings → Google → Voice input, or type instead.',
      );
    }
  });

  if (!enabled || !available) return null;

  const toggle = async () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perms.granted) return;
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang: 'fil-PH', interimResults: true });
  };

  return (
    <View style={styles.wrap}>
      <Pressable accessibilityLabel="Voice input" onPress={toggle} style={[styles.mic, listening && styles.micActive]}>
        <Ionicons name={listening ? 'mic' : 'mic-outline'} size={22} color={listening ? '#fff' : theme.colors.accent} />
      </Pressable>
      {listening && <Text style={styles.hint}>Listening…</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  mic: { backgroundColor: theme.colors.accentSoft, borderRadius: 24, padding: 12 },
  micActive: { backgroundColor: theme.colors.accent },
  hint: { color: theme.colors.muted, fontSize: 14 },
});
```

In `app/(tabs)/index.tsx`, below the `TextInput`:

```tsx
<MicButton enabled={direction === 'tl-ceb'} onTranscript={setText} />
```

- [ ] **Step 3: Create eas.json and a dev build**

Create `eas.json`:

```json
{
  "cli": { "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": { "autoIncrement": true }
  },
  "submit": { "production": {} }
}
```

Run (requires a free Expo account — `npx eas-cli login` first):

```powershell
npx eas-cli build --platform android --profile development
```

Expected: cloud build succeeds; install the APK from the build link on the phone, then run `npx expo start --dev-client`.

- [ ] **Step 4: Verify manually**

On the dev build: mic button visible only in Tagalog→Bisaya direction; tapping it and speaking Tagalog fills the input and translation updates live; in airplane mode it either works (offline pack installed) or shows the friendly explanation.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "Add Tagalog voice input via device speech recognizer"
```

---

### Task 12: Release preparation

**Files:**
- Modify: `app.json` (identity, icons)
- Create: `docs/privacy-policy.md`, `docs/release-checklist.md`

**Interfaces:**
- Consumes: everything.
- Produces: production `.aab` ready for Play Console upload.

- [ ] **Step 1: App identity**

In `app.json` set:

```json
{
  "expo": {
    "name": "LeyText Learn",
    "slug": "leytext-learn",
    "version": "1.0.0",
    "android": {
      "package": "com.ashly.leytextlearn"
    }
  }
}
```

(Keep existing template fields — icons/splash from the template are acceptable for first submission; replace `assets/images/icon.png`, `adaptive-icon.png`, and `splash-icon.png` with branded art if available.)

- [ ] **Step 2: Privacy policy**

Create `docs/privacy-policy.md`:

```markdown
# LeyText Learn — Privacy Policy

Effective: 2026-07-08

LeyText Learn works fully offline and collects no data.

- The app makes no network connections. Nothing you type, speak, or save
  ever leaves your device.
- Translation history and favorites are stored only on your device and can
  be cleared from Settings, or removed entirely by uninstalling the app.
- Voice input (optional) uses your phone's built-in speech recognizer.
  If your device's recognizer processes audio online, that is governed by
  your device/Google's policies, not this app; the app itself sends nothing.
- No accounts, no analytics, no ads, no third-party SDKs.

Contact: johngasacaoashly@gmail.com
```

Host this file anywhere public (e.g., a GitHub repo page or Gist) — Play Console requires a URL. **User task.**

- [ ] **Step 3: Release checklist**

Create `docs/release-checklist.md`:

```markdown
# Release Checklist (run before every release)

## Automated
- [ ] `npm test` — all green
- [ ] `npm run build:db` — exits 0, counts printed

## On a real Android device, AIRPLANE MODE ON
- [ ] Fresh install launches without errors
- [ ] TL→CEB word, sentence, and known phrase translate correctly
- [ ] CEB→TL direction works after swap
- [ ] Unknown word shows gray/italic + note
- [ ] Phrasebook: all six categories open, search works
- [ ] History records; favorites star/unstar; both survive app restart
- [ ] TTS speaks (or icon hidden if no Filipino voice)
- [ ] Mic: works with offline pack, or shows friendly notice
- [ ] Settings: default direction persists; clear history works

## Store
- [ ] Version bumped in app.json
- [ ] `npx eas-cli build --platform android --profile production`
- [ ] Upload .aab to Play Console, attach privacy policy URL
```

- [ ] **Step 4: Run the checklist and build**

Run everything in `docs/release-checklist.md`. Then:

```powershell
npx eas-cli build --platform android --profile production
```

Expected: build succeeds, producing an `.aab` download link.

**User tasks after this (cannot be automated):** create the $25 Google Play developer account, create the app listing (screenshots can be captured from the dev build), paste the hosted privacy policy URL, upload the `.aab`, and submit for review.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "Prepare v1.0.0 release: identity, privacy policy, release checklist"
```

---

## Self-Review Notes

- **Spec coverage:** engine strategies 1–2 (Tasks 2–3), bundled SQLite + CSV pipeline (Task 4–5), all four screens (Tasks 6–8, 10), honest labeling (Task 6), suggestions on unknown single words (Task 6), TTS with notice (Task 9), voice input with offline handling (Task 11), airplane-mode release gate + Play Store prep + credits (Tasks 10, 12). v2 slot needs no code now — the `Lexicon`/strategy seam in Task 3 is the slot.
- **Deferred from spec:** spec's "5,000–15,000 word" aspiration is set as ≥800 at build-gate level; growing the CSVs is ongoing content work the user (bilingual) drives, and the gate threshold can be raised without code changes.
- **Type consistency check:** `Direction`, `TranslationResult`, `Lexicon`, `PhraseEntry`, `SavedEntry`, `Settings` are each defined once and imported everywhere else; verified names match across tasks.
