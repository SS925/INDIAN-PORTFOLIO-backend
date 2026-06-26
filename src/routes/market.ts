import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../utils/errors';
import { getHistory, getQuote, search } from '../services/yahoo';
import { HistoryRange } from '../types';

export const marketRouter = Router();

const searchSchema = z.object({ q: z.string().min(1, 'q is required') });

/** GET /search?q=Reliance */
marketRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0].message);
    }
    const results = await search(parsed.data.q);
    res.json(results);
  }),
);

/** GET /quote/:symbol */
marketRouter.get(
  '/quote/:symbol',
  asyncHandler(async (req, res) => {
    const { symbol } = req.params;
    if (!symbol) throw new HttpError(400, 'symbol is required');
    const quote = await getQuote(symbol);
    res.json(quote);
  }),
);

const VALID_RANGES: HistoryRange[] = ['1d', '1w', '1mo', '6mo', '1y', '5y'];

/** GET /history/:symbol?range=1mo */
marketRouter.get(
  '/history/:symbol',
  asyncHandler(async (req, res) => {
    const { symbol } = req.params;
    if (!symbol) throw new HttpError(400, 'symbol is required');

    const range = (req.query.range as HistoryRange) ?? '1mo';
    if (!VALID_RANGES.includes(range)) {
      throw new HttpError(
        400,
        `Invalid range. Use one of: ${VALID_RANGES.join(', ')}`,
      );
    }
    const history = await getHistory(symbol, range);
    res.json(history);
  }),
);
