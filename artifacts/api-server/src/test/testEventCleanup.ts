/**
 * Test-only stale event cleanup — never runs in production.
 */

import { pool } from "@workspace/db";
import { logger } from "../lib/logger.js";

const STALE_HOURS = 24;

export function isTestEventCleanupAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.ALLOW_TEST_EVENT_CLEANUP === "true") return true;
  return process.env.NODE_ENV === "test";
}

/**
 * Archives stale test-created events older than 24h when test metadata is present.
 * Returns count of rows marked ignored (status update only — no destructive delete).
 */
export async function cleanupStaleTestEvents(): Promise<number> {
  if (!isTestEventCleanupAllowed()) {
    logger.warn("[TestEventCleanup] Skipped — not allowed outside test environment");
    return 0;
  }

  try {
    const result = await pool.query<{ count: string }>(
      `WITH updated AS (
         UPDATE events
         SET status = 'processed',
             processed_at = NOW()
         WHERE created_at < NOW() - INTERVAL '${STALE_HOURS} hours'
           AND status IN ('pending', 'retry_pending', 'claimed')
           AND (
             user_id IN (SELECT id FROM users WHERE email LIKE '%@test.%' OR email LIKE '%+test%')
             OR payload::text LIKE '%"test_run":true%'
             OR payload::text LIKE '%"e2e_test":true%'
           )
         RETURNING id
       )
       SELECT COUNT(*)::text AS count FROM updated`,
    );
    const count = Number(result.rows[0]?.count ?? 0);
    if (count > 0) {
      logger.info({ count }, "[TestEventCleanup] Marked stale test events as processed");
    }
    return count;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[TestEventCleanup] Cleanup failed",
    );
    return 0;
  }
}
