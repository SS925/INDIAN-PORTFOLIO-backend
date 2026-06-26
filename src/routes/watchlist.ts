import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../utils/errors';
import {
  addToWatchlist,
  listWatchlistWithQuotes,
  removeFromWatchlist,
} from '../services/watchlist';

export const watchlistRouter = Router();

const watchlistSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  exchange: z.string().min(1),
  assetType: z.string().min(1),
});

/** GET /watchlist — entries with live quotes. */
watchlistRouter.get(
  '/watchlist',
  asyncHandler(async (_req, res) => {
    res.json(await listWatchlistWithQuotes());
  }),
);

/** POST /watchlist — add a symbol. */
watchlistRouter.post(
  '/watchlist',
  asyncHandler(async (req, res) => {
    const parsed = watchlistSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0].message);
    }
    // assetType is validated as string then narrowed by the service layer.
    res.status(201).json(
      addToWatchlist({
        ...parsed.data,
        assetType: parsed.data.assetType as never,
      }),
    );
  }),
);

/** DELETE /watchlist/:id — remove by row id or symbol. */
watchlistRouter.delete(
  '/watchlist/:id',
  asyncHandler(async (req, res) => {
    const ok = removeFromWatchlist(req.params.id);
    if (!ok) throw new HttpError(404, 'Watchlist item not found');
    res.status(204).send();
  }),
);
