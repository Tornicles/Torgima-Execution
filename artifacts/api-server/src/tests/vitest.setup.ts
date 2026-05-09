/**
 * Vitest runs this before test files. `@workspace/db` requires DATABASE_URL at import time;
 * unit tests that pull in engines otherwise fail before any assertions run.
 *
 * Integration tests that execute SQL still need a reachable Postgres (or will fail on query).
 */
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@127.0.0.1:5432/torgima_vitest_stub";
