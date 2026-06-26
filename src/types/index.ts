/**
 * Shared backend domain types.
 * These mirror the shapes returned by the REST API to the Expo client.
 */

export type AssetType = 'EQUITY' | 'ETF' | 'MUTUALFUND' | 'INDEX' | 'REIT' | 'CRYPTOCURRENCY' | 'CURRENCY' | 'FUTURE' | 'OTHER';

/** A single search result item. */
export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  assetType: AssetType;
  currency: string | null;
  price: number | null;
}

/** A normalized quote used by details, portfolio and watchlist screens. */
export interface Quote {
  symbol: string;
  name: string;
  exchange: string;
  assetType: AssetType;
  currency: string;
  price: number | null;
  previousClose: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  marketCap: number | null;
  volume: number | null;
  /** Net Asset Value for mutual funds, when available. */
  nav: number | null;
}

/** Chart range tokens supported by the history endpoint. */
export type HistoryRange = '1d' | '1w' | '1mo' | '6mo' | '1y' | '5y';

export interface HistoryPoint {
  /** Epoch milliseconds. */
  time: number;
  close: number;
}

export interface HistoryResponse {
  symbol: string;
  range: HistoryRange;
  currency: string | null;
  points: HistoryPoint[];
}

/** Persisted portfolio holding (DB row shape, camelCased). */
export interface Holding {
  id: string;
  name: string;
  symbol: string;
  exchange: string;
  quantity: number;
  avgBuyPrice: number;
  purchaseDate: string; // ISO date (YYYY-MM-DD)
  createdAt: string;
  updatedAt: string;
}

/** Holding enriched with live market computations. */
export interface HoldingWithMetrics extends Holding {
  currentPrice: number | null;
  previousClose: number | null;
  currency: string | null;
  currentValue: number | null;
  investedValue: number;
  profitLoss: number | null;
  profitPercent: number | null;
  todayGainLoss: number | null;
}

/** Persisted watchlist entry. */
export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  assetType: AssetType;
  createdAt: string;
}

/** Watchlist entry enriched with a live quote. */
export interface WatchlistItemWithQuote extends WatchlistItem {
  price: number | null;
  currency: string | null;
  dayChange: number | null;
  dayChangePercent: number | null;
}
