import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { normalizeText } from '../src/engine/normalize';

const OUT = 'assets/db/dictionary.db';

interface WordRow { tl: string; ceb: string; pos: string; note: string; }
interface PhraseRow { category: string; tl: string; ceb: string; pron: string; }
interface AffixRow { type: string; tl: string; ceb: string; }

const CATEGORIES = new Set(['greetings', 'directions', 'food', 'shopping', 'emergencies', 'small_talk']);
const AFFIX_TYPES = new Set(['prefix', 'infix', 'suffix']);

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
  CREATE TABLE affixes (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('prefix', 'infix', 'suffix')),
    tl TEXT NOT NULL,
    ceb TEXT NOT NULL
  );
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

const affixes = readCsv<AffixRow>('data/affixes.csv');
const insertAffix = db.prepare('INSERT INTO affixes (type, tl, ceb) VALUES (?, ?, ?)');
for (const a of affixes) {
  if (!AFFIX_TYPES.has(a.type)) throw new Error(`Unknown affix type "${a.type}" in: ${JSON.stringify(a)}`);
  const tl = normalizeText(a.tl);
  const ceb = normalizeText(a.ceb);
  if (!tl || !ceb) throw new Error(`Bad affix row: ${JSON.stringify(a)}`);
  insertAffix.run(a.type, tl, ceb);
}

db.close();

const counts = { words: words.length, phrases: phrases.length, affixes: affixes.length };
console.log(`Built ${OUT}: ${counts.words} words, ${counts.phrases} phrases, ${counts.affixes} affixes`);
if (counts.words < 800 || counts.phrases < 150 || counts.affixes < 10) {
  console.error('FAIL: below minimum volume (need >=800 words, >=150 phrases, >=10 affixes)');
  process.exit(1);
}
