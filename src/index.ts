import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { config } from './utils/config';
import { errorMiddleware } from './utils/errors';
import { marketRouter } from './routes/market';
import { portfolioRouter } from './routes/portfolio';
import { watchlistRouter } from './routes/watchlist';

const app = express();

app.use(
  cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
  }),
);
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Routes (mounted at root to match the required API paths)
app.use('/', marketRouter);
app.use('/', portfolioRouter);
app.use('/', watchlistRouter);

// Error handler must be last
app.use(errorMiddleware);

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Backend listening on http://localhost:${config.port}`);
});
