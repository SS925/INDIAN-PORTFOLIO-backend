import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../utils/errors';
import {
  createHolding,
  deleteHolding,
  listHoldingsWithMetrics,
  updateHolding,
} from '../services/portfolio';

export const portfolioRouter = Router();

const holdingSchema = z.object({
  name: z.string().min(1),
  symbol: z.string().min(1),
  exchange: z.string().min(1),
  quantity: z.number().positive(),
  avgBuyPrice: z.number().positive(),
  purchaseDate: z.string().min(1), // ISO date string
});

/** GET /portfolio — all holdings with computed metrics. */
portfolioRouter.get(
  '/portfolio',
  asyncHandler(async (_req, res) => {
    res.json(await listHoldingsWithMetrics());
  }),
);

/** POST /portfolio — add a holding. */
portfolioRouter.post(
  '/portfolio',
  asyncHandler(async (req, res) => {
    const parsed = holdingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0].message);
    }
    res.status(201).json(createHolding(parsed.data));
  }),
);

/** PUT /portfolio/:id — edit a holding. */
portfolioRouter.put(
  '/portfolio/:id',
  asyncHandler(async (req, res) => {
    const parsed = holdingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0].message);
    }
    const updated = updateHolding(req.params.id, parsed.data);
    if (!updated) throw new HttpError(404, 'Holding not found');
    res.json(updated);
  }),
);

/** DELETE /portfolio/:id — remove a holding. */
portfolioRouter.delete(
  '/portfolio/:id',
  asyncHandler(async (req, res) => {
    const ok = deleteHolding(req.params.id);
    if (!ok) throw new HttpError(404, 'Holding not found');
    res.status(204).send();
  }),
);
