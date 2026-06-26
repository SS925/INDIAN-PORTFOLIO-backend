import { NextFunction, Request, Response } from 'express';

/** A typed HTTP error carrying a status code. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

/** Wraps an async route handler so thrown/rejected errors hit the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** Express error-handling middleware. Must be registered last. */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Surface yahoo-finance2 validation/network errors gracefully.
  const message =
    err instanceof Error ? err.message : 'An unexpected error occurred';
  // eslint-disable-next-line no-console
  console.error('[error]', message);
  res.status(500).json({ error: message });
}
