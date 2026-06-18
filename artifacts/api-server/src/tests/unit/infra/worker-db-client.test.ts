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

  it("normalizes Supabase pooler URLs for transaction mode", async () => {
    const { normalizeWorkerDatabaseUrl } = await import("@workspace/db");
    const url = normalizeWorkerDatabaseUrl(
      "postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
    );
    expect(url).toContain("6543");
    expect(url).toContain("pgbouncer=true");
    expect(url).toContain("connection_limit=1");
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
