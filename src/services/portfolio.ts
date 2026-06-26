import { v4 as uuid } from 'uuid';
import { db } from '../db';
import { Holding, HoldingWithMetrics } from '../types';
import { getQuotes } from './yahoo';

export interface HoldingInput {
  name: string;
  symbol: string;
  exchange: string;
  quantity: number;
  avgBuyPrice: number;
  purchaseDate: string;
}

const insertStmt = db.prepare(`
  INSERT INTO holdings (id, name, symbol, exchange, quantity, avgBuyPrice, purchaseDate, createdAt, updatedAt)
  VALUES (@id, @name, @symbol, @exchange, @quantity, @avgBuyPrice, @purchaseDate, @createdAt, @updatedAt)
`);
const updateStmt = db.prepare(`
  UPDATE holdings SET
    name = @name, symbol = @symbol, exchange = @exchange,
    quantity = @quantity, avgBuyPrice = @avgBuyPrice,
    purchaseDate = @purchaseDate, updatedAt = @updatedAt
  WHERE id = @id
`);
const deleteStmt = db.prepare(`DELETE FROM holdings WHERE id = ?`);
const getByIdStmt = db.prepare(`SELECT * FROM holdings WHERE id = ?`);
const listStmt = db.prepare(`SELECT * FROM holdings ORDER BY createdAt DESC`);

export function createHolding(input: HoldingInput): Holding {
  const now = new Date().toISOString();
  const row: Holding = {
    id: uuid(),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  insertStmt.run(row);
  return row;
}

export function updateHolding(
  id: string,
  input: HoldingInput,
): Holding | null {
  const existing = getByIdStmt.get(id) as Holding | undefined;
  if (!existing) return null;
  const updated: Holding = {
    ...existing,
    ...input,
    id,
    updatedAt: new Date().toISOString(),
  };
  updateStmt.run(updated);
  return updated;
}

export function deleteHolding(id: string): boolean {
  const info = deleteStmt.run(id);
  return info.changes > 0;
}

function listHoldings(): Holding[] {
  return listStmt.all() as Holding[];
}

/**
 * Returns all holdings enriched with live quote metrics:
 *  - currentValue   = currentPrice * quantity
 *  - investedValue  = avgBuyPrice * quantity
 *  - profitLoss     = currentValue - investedValue
 *  - profitPercent  = profitLoss / investedValue * 100
 *  - todayGainLoss  = (currentPrice - previousClose) * quantity
 */
export async function listHoldingsWithMetrics(): Promise<HoldingWithMetrics[]> {
  const holdings = listHoldings();
  const quotes = await getQuotes(holdings.map((h) => h.symbol));

  return holdings.map((h) => {
    const quote = quotes.get(h.symbol) ?? null;
    const currentPrice = quote?.price ?? null;
    const previousClose = quote?.previousClose ?? null;
    const investedValue = h.avgBuyPrice * h.quantity;
    const currentValue = currentPrice != null ? currentPrice * h.quantity : null;
    const profitLoss = currentValue != null ? currentValue - investedValue : null;
    const profitPercent =
      profitLoss != null && investedValue > 0
        ? (profitLoss / investedValue) * 100
        : null;
    const todayGainLoss =
      currentPrice != null && previousClose != null
        ? (currentPrice - previousClose) * h.quantity
        : null;

    return {
      ...h,
      currentPrice,
      previousClose,
      currency: quote?.currency ?? null,
      currentValue,
      investedValue,
      profitLoss,
      profitPercent,
      todayGainLoss,
    };
  });
}
