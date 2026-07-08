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
