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
