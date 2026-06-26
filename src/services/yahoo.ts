import yahooFinance from 'yahoo-finance2';
import NodeCache from 'node-cache';
import { config } from '../utils/config';
import {
  AssetType,
  HistoryRange,
  HistoryResponse,
  Quote,
  SearchResult,
} from '../types';

/**
 * Yahoo has no official public finance API, so we proxy yahoo-finance2 here and
 * expose clean, normalized REST shapes to the Expo client.
 *
 * Caches:
 *  - quoteCache:  30s TTL (configurable) to satisfy the "cache quotes" requirement.
 *  - searchCache: short TTL to keep autocomplete snappy without hammering Yahoo.
 */
const quoteCache = new NodeCache({ stdTTL: config.quoteCacheTtl, checkperiod: 15 });
const searchCache = new NodeCache({ stdTTL: config.searchCacheTtl, checkperiod: 30 });
const historyCache = new NodeCache({ stdTTL: 60, checkperiod: 30 });

// Silence yahoo-finance2 "survey" + schema-validation noise; we normalize ourselves.
yahooFinance.setGlobalConfig({
  validation: { logErrors: false, logOptionsErrors: false },
});

/** Maps Yahoo's quoteType strings to our AssetType union. */
function mapAssetType(quoteType?: string): AssetType {
  switch ((quoteType ?? '').toUpperCase()) {
    case 'EQUITY':
      return 'EQUITY';
    case 'ETF':
      return 'ETF';
    case 'MUTUALFUND':
      return 'MUTUALFUND';
    case 'INDEX':
      return 'INDEX';
    case 'CRYPTOCURRENCY':
      return 'CRYPTOCURRENCY';
    case 'CURRENCY':
      return 'CURRENCY';
    case 'FUTURE':
      return 'FUTURE';
    default:
      return 'OTHER';
  }
}

/**
 * Search across NSE/BSE stocks, ETFs and mutual funds.
 * Supports partial matching / autocomplete — Yahoo's own search handles fuzzy input,
 * so "reli", "parag", "motilal" all return suggestions.
 *
 * Indian listings are biased to the top: results are lightly re-ranked so that
 * .NS (NSE) and .BO (BSE) symbols surface first, matching an Indian-market app's intent.
 */
export async function search(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = searchCache.get<SearchResult[]>(cacheKey);
  if (cached) return cached;

  const raw = await yahooFinance.search(q, {
    quotesCount: 25,
    newsCount: 0,
    enableFuzzyQuery: true,
  });

  const quotes = (raw.quotes ?? []).filter(
    (item): item is Extract<typeof item, { symbol: string }> =>
      'symbol' in item && typeof item.symbol === 'string',
  );

  const results: SearchResult[] = quotes.map((item) => {
    const anyItem = item as Record<string, unknown>;
    const exchange =
      (anyItem.exchDisp as string) ?? (anyItem.exchange as string) ?? '';
    return {
      symbol: item.symbol,
      name:
        (anyItem.shortname as string) ??
        (anyItem.longname as string) ??
        item.symbol,
      exchange,
      assetType: mapAssetType(anyItem.quoteType as string),
      currency: null, // search payload has no price/currency; filled lazily via /quote
      price: null,
    };
  });

  // Re-rank: Indian listings first (.NS, .BO, NSI/BSE exchanges), preserving order otherwise.
  const isIndian = (r: SearchResult) =>
    /\.(NS|BO)$/i.test(r.symbol) ||
    /NSE|BSE|NSI/i.test(r.exchange);
  const ranked = [
    ...results.filter(isIndian),
    ...results.filter((r) => !isIndian(r)),
  ];

  searchCache.set(cacheKey, ranked);
  return ranked;
}

/** Fetch and normalize a single quote. Cached for QUOTE_CACHE_TTL seconds. */
export async function getQuote(symbol: string): Promise<Quote> {
  const cacheKey = `quote:${symbol}`;
  const cached = quoteCache.get<Quote>(cacheKey);
  if (cached) return cached;

  const q = (await yahooFinance.quote(symbol)) as Record<string, unknown>;

  const normalized: Quote = {
    symbol: (q.symbol as string) ?? symbol,
    name:
      (q.longName as string) ??
      (q.shortName as string) ??
      (q.symbol as string) ??
      symbol,
    exchange: (q.fullExchangeName as string) ?? (q.exchange as string) ?? '',
    assetType: mapAssetType(q.quoteType as string),
    currency: (q.currency as string) ?? 'INR',
    price:
      (q.regularMarketPrice as number) ??
      (q.navPrice as number) ??
      null,
    previousClose: (q.regularMarketPreviousClose as number) ?? null,
    open: (q.regularMarketOpen as number) ?? null,
    dayHigh: (q.regularMarketDayHigh as number) ?? null,
    dayLow: (q.regularMarketDayLow as number) ?? null,
    dayChange: (q.regularMarketChange as number) ?? null,
    dayChangePercent: (q.regularMarketChangePercent as number) ?? null,
    fiftyTwoWeekHigh: (q.fiftyTwoWeekHigh as number) ?? null,
    fiftyTwoWeekLow: (q.fiftyTwoWeekLow as number) ?? null,
    marketCap: (q.marketCap as number) ?? null,
    volume: (q.regularMarketVolume as number) ?? null,
    nav: (q.navPrice as number) ?? null,
  };

  quoteCache.set(cacheKey, normalized);
  return normalized;
}

/** Batch quotes for portfolio/watchlist enrichment. Falls back to per-symbol on failure. */
export async function getQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const map = new Map<string, Quote>();
  const unique = Array.from(new Set(symbols)).filter(Boolean);
  await Promise.all(
    unique.map(async (s) => {
      try {
        map.set(s, await getQuote(s));
      } catch {
        // Skip symbols Yahoo can't resolve; caller treats them as null-price.
      }
    }),
  );
  return map;
}

/** Maps our range token to Yahoo chart {range, interval}. */
function rangeToChartParams(range: HistoryRange): {
  range: string;
  interval: '5m' | '15m' | '60m' | '1d' | '1wk';
} {
  switch (range) {
    case '1d':
      return { range: '1d', interval: '5m' };
    case '1w':
      return { range: '5d', interval: '15m' };
    case '1mo':
      return { range: '1mo', interval: '1d' };
    case '6mo':
      return { range: '6mo', interval: '1d' };
    case '1y':
      return { range: '1y', interval: '1d' };
    case '5y':
      return { range: '5y', interval: '1wk' };
    default:
      return { range: '1mo', interval: '1d' };
  }
}

/** Fetch historical close prices for charting. Cached briefly. */
export async function getHistory(
  symbol: string,
  range: HistoryRange,
): Promise<HistoryResponse> {
  const cacheKey = `history:${symbol}:${range}`;
  const cached = historyCache.get<HistoryResponse>(cacheKey);
  if (cached) return cached;

  const { range: yRange, interval } = rangeToChartParams(range);

  const result = (await yahooFinance.chart(symbol, {
    range: yRange,
    interval,
  })) as {
    meta?: { currency?: string };
    quotes?: { date: Date; close: number | null }[];
  };

  const points = (result.quotes ?? [])
    .filter((p) => p.close != null && p.date instanceof Date)
    .map((p) => ({ time: p.date.getTime(), close: p.close as number }));

  const response: HistoryResponse = {
    symbol,
    range,
    currency: result.meta?.currency ?? null,
    points,
  };

  historyCache.set(cacheKey, response);
  return response;
}
