import dotenv from 'dotenv';

dotenv.config();

/** Centralized, typed access to environment configuration. */
export const config = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  dbPath: process.env.DB_PATH ?? './data/portfolio.db',
  quoteCacheTtl: parseInt(process.env.QUOTE_CACHE_TTL ?? '30', 10),
  searchCacheTtl: parseInt(process.env.SEARCH_CACHE_TTL ?? '60', 10),
};
