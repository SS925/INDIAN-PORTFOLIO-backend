import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../utils/config';

/**
 * Initializes (and migrates) the SQLite database, returning a singleton handle.
 * Tables: holdings, watchlist.
 */
function createDb(): Database.Database {
  const dbFile = path.resolve(process.cwd(), config.dbPath);
  const dir = path.dirname(dbFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS holdings (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      symbol        TEXT NOT NULL,
      exchange      TEXT NOT NULL,
      quantity      REAL NOT NULL,
      avgBuyPrice   REAL NOT NULL,
      purchaseDate  TEXT NOT NULL,
      createdAt     TEXT NOT NULL,
      updatedAt     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id         TEXT PRIMARY KEY,
      symbol     TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      exchange   TEXT NOT NULL,
      assetType  TEXT NOT NULL,
      createdAt  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings(symbol);
  `);

  return db;
}

export const db = createDb();
