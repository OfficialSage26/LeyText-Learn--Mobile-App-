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
