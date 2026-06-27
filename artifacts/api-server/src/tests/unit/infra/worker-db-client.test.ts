import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Cloudflare Worker database client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses postgres-js (not node-postgres Pool) on Workers runtime", () => {
    const dbIndex = readRepo("lib/db/src/index.ts");
    expect(dbIndex).toContain('import postgres from "postgres"');
    expect(dbIndex).toContain("drizzle-orm/postgres-js");
    expect(dbIndex).toContain("idle_timeout: 20");
    expect(dbIndex).toContain("connect_timeout: 12");
    expect(dbIndex).toContain("prepare: false");
    expect(dbIndex).toContain("executeHealthSql");
    expect(dbIndex).not.toContain("pg.Pool is not available");
  });

  it("binds DATABASE_URL from Worker env via bindWorkerDatabaseUrl", () => {
    const runtime = readRepo("artifacts/api-server/src/lib/cloudflare-runtime.ts");
    expect(runtime).toContain("bindWorkerDatabaseUrl");
    expect(runtime).toContain("bindWorkerDatabaseUrl(nextDbUrl)");
  });

  it("normalizes Supabase pooler URLs for transaction mode", () => {
    const dbIndex = readRepo("lib/db/src/index.ts");
    expect(dbIndex).toContain("export function normalizeWorkerDatabaseUrl");
    expect(dbIndex).toContain('parsed.port = "6543"');
    expect(dbIndex).toContain('"pgbouncer", "true"');
    expect(dbIndex).toContain('"connection_limit", "1"');
  });

  it("unit test stub DATABASE_URL fails fast without live Postgres", () => {
    const dbIndex = readRepo("lib/db/src/index.ts");
    const setup = readRepo("artifacts/api-server/src/tests/vitest.setup.ts");
    expect(dbIndex).toContain("isVitestUnitStubDatabase");
    expect(dbIndex).toContain("torgima_vitest_stub");
    expect(setup).toContain("torgima_vitest_stub");
    expect(setup).toContain("TORGIMA_INTEGRATION");
  });

  it("registers auth schema alignment migration for magic link tables", () => {
    const journal = readRepo("migrations/meta/_journal.json");
    const migration = readRepo("migrations/0039_users_auth_magic_link_schema_alignment.sql");
    expect(journal).toContain("0039_users_auth_magic_link_schema_alignment");
    expect(migration).toContain("magic_link_tokens");
    expect(migration).toContain("execution_state");
    expect(migration).toContain("civilization_context");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS");
  });
});
