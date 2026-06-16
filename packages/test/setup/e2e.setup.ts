/**
 * DOC 36 — E2E test environment setup (runs before full loop suites).
 * Does not clear shared erector capability graph or verdict rules.
 */
import { db } from "@workspace/db";
import { verifyErectorSchema, seedErectorCatalog } from "@workspace/db/erector-seed";

let setupComplete = false;

export type E2eSetupResult = {
  erectorSchemaOk: boolean;
  integrationFlag: boolean;
};

/** Verify DB, erector catalog, and enable integration mode for workers. */
export async function setupE2eEnvironment(): Promise<E2eSetupResult> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DOC36 setup: DATABASE_URL is required");
  }

  process.env.TORGIMA_INTEGRATION = "true";
  process.env.WORKERS_TEST_MODE = process.env.WORKERS_TEST_MODE ?? "true";

  const erectorSchemaOk = await verifyErectorSchema(db);
  if (!erectorSchemaOk) {
    throw new Error("DOC36 setup: erector schema verification failed (expect 27+ erector_ tables)");
  }

  try {
    await seedErectorCatalog(db);
  } catch {
    // Shared seed data — idempotent; do not fail if already present.
  }

  setupComplete = true;
  return { erectorSchemaOk, integrationFlag: true };
}

export async function teardownE2eEnvironment(): Promise<void> {
  // Per-suite user reset is handled by doc36-reset; shared seeds are preserved.
  setupComplete = false;
}

export function isE2eSetupComplete(): boolean {
  return setupComplete;
}
