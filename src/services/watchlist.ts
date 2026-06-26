import { v4 as uuid } from 'uuid';
import { db } from '../db';
import {
  AssetType,
  WatchlistItem,
  WatchlistItemWithQuote,
} from '../types';
import { getQuotes } from './yahoo';

export interface WatchlistInput {
  symbol: string;
  name: string;
  exchange: string;
  assetType: AssetType;
}

const insertStmt = db.prepare(`
  INSERT INTO watchlist (id, symbol, name, exchange, assetType, createdAt)
  VALUES (@id, @symbol, @name, @exchange, @assetType, @createdAt)
  ON CONFLICT(symbol) DO NOTHING
`);
const deleteStmt = db.prepare(`DELETE FROM watchlist WHERE id = ?`);
const deleteBySymbolStmt = db.prepare(`DELETE FROM watchlist WHERE symbol = ?`);
const listStmt = db.prepare(`SELECT * FROM watchlist ORDER BY createdAt DESC`);
const getBySymbolStmt = db.prepare(`SELECT * FROM watchlist WHERE symbol = ?`);

export function addToWatchlist(input: WatchlistInput): WatchlistItem {
  const existing = getBySymbolStmt.get(input.symbol) as
    | WatchlistItem
    | undefined;
  if (existing) return existing;

  const row: WatchlistItem = {
    id: uuid(),
    ...input,
    createdAt: new Date().toISOString(),
  };
  insertStmt.run(row);
  return row;
}

/** Deletes by row id; falls back to deleting by symbol for client convenience. */
export function removeFromWatchlist(idOrSymbol: string): boolean {
  let info = deleteStmt.run(idOrSymbol);
  if (info.changes === 0) {
    info = deleteBySymbolStmt.run(idOrSymbol);
  }
  return info.changes > 0;
}

function listWatchlist(): WatchlistItem[] {
  return listStmt.all() as WatchlistItem[];
}

/** Returns the watchlist with live price + day-change attached to each row. */
export async function listWatchlistWithQuotes(): Promise<
  WatchlistItemWithQuote[]
> {
  const items = listWatchlist();
  const quotes = await getQuotes(items.map((i) => i.symbol));

  return items.map((item) => {
    const quote = quotes.get(item.symbol) ?? null;
    return {
      ...item,
      price: quote?.price ?? null,
      currency: quote?.currency ?? null,
      dayChange: quote?.dayChange ?? null,
      dayChangePercent: quote?.dayChangePercent ?? null,
    };
  });
}
