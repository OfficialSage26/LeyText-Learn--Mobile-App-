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
