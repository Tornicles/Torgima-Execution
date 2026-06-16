/**
 * DOC28 Task 1 — Postgres advisory lock coordination.
 */

import { createHash } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger.js";

export type AdvisoryLockScope = "USER" | "BLUEPRINT" | "ORDER" | "NONE";

export function hashToInt(input: string): bigint {
  const hash = createHash("sha256").update(input).digest();
  const value = hash.readBigInt64BE(0);
  return value < 0n ? -value : value;
}

export function advisoryLockKey(scope: AdvisoryLockScope, entityId: string): string {
  if (scope === "NONE") return "";
  return `${scope}:${entityId}`;
}

export class LockManager {
  static lockKey(scope: AdvisoryLockScope, entityId: string): string {
    return advisoryLockKey(scope, entityId);
  }

  /** Transaction-scoped advisory lock via pg_try_advisory_xact_lock. */
  static async acquire(scope: AdvisoryLockScope, entityId: string): Promise<boolean> {
    if (scope === "NONE") return true;

    const lockInt = hashToInt(advisoryLockKey(scope, entityId)).toString();
    try {
      const result = await db.execute<{ acquired: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(${lockInt}::bigint) as acquired`,
      );
      const row = Array.isArray(result)
        ? result[0]
        : (result as { rows?: Array<{ acquired: boolean }> }).rows?.[0];
      return row?.acquired === true;
    } catch (err) {
      logger.warn({ err, scope, entityId }, "[LockManager] advisory lock acquire failed");
      return false;
    }
  }
}

export const LOCK_SCOPE_DESCRIPTIONS: Record<Exclude<AdvisoryLockScope, "NONE">, string> = {
  USER: "Prevents multiple full-loop workflows for the same user",
  BLUEPRINT: "Prevents colliding feedback processing and task generation cycles",
  ORDER: "Prevents duplicate feedback submission for the same order",
};
