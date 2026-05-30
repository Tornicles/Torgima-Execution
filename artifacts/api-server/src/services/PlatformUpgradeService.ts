/**
 * Platform upgrade — archive access and execution reset lifecycle.
 */
import { db, users } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { TorgimaError } from "../lib/errors.js";

export type UpgradeStatus = {
  requiresUpgrade: boolean;
  executionState: string;
  firstLoginAfterUpgrade: boolean;
  archivedCounts: Record<string, number>;
  migrationApplied: boolean;
};

type UserUpgradeRow = typeof users.$inferSelect;

function readExecutionState(user: UserUpgradeRow): string {
  return user.execution_state ?? "NORMAL";
}

function readFirstLoginFlag(user: UserUpgradeRow): boolean {
  return Boolean(user.first_login_after_upgrade);
}

export const PlatformUpgradeService = {
  async getStatus(userId: string): Promise<UpgradeStatus> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new TorgimaError("NOT_FOUND", "User not found", false);

    const u = user as UserUpgradeRow;
    const executionState = readExecutionState(u);

    const archiveRows = await db.execute<{ entity_type: string; count: string }>(sql`
      SELECT entity_type, COUNT(*)::text AS count
      FROM platform_upgrade_archive
      WHERE user_id = ${userId}::uuid
      GROUP BY entity_type
    `);

    const archivedCounts: Record<string, number> = {};
    for (const row of archiveRows.rows ?? []) {
      archivedCounts[row.entity_type] = Number(row.count ?? 0);
    }

    const migrationRows = await db.execute<{ id: string }>(sql`
      SELECT id FROM platform_upgrade_migrations WHERE id = 'platform_upgrade_v1_20260604' LIMIT 1
    `);

    return {
      requiresUpgrade: executionState === "RESET_REQUIRED",
      executionState,
      firstLoginAfterUpgrade: readFirstLoginFlag(u),
      archivedCounts,
      migrationApplied: (migrationRows.rows?.length ?? 0) > 0,
    };
  },

  async listArchivedSummary(userId: string) {
    const rows = await db.execute<{
      entity_type: string;
      entity_id: string;
      archived_at: Date;
      payload: Record<string, unknown>;
    }>(sql`
      SELECT entity_type, entity_id, archived_at, payload
      FROM platform_upgrade_archive
      WHERE user_id = ${userId}::uuid
      ORDER BY archived_at DESC
      LIMIT 100
    `);

    return (rows.rows ?? []).map((r) => ({
      entityType: r.entity_type,
      entityId: r.entity_id,
      archivedAt: r.archived_at,
      title:
        String((r.payload as { goal?: string; title?: string; raw_goal?: string }).goal ??
          (r.payload as { title?: string }).title ??
          (r.payload as { raw_goal?: string }).raw_goal ??
          r.entity_type),
      status: String((r.payload as { status?: string }).status ?? "archived"),
    }));
  },

  async acknowledgeUpgradeScreen(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ first_login_after_upgrade: false })
      .where(eq(users.id, userId));
  },

  async completeUpgradeAfterLaunch(userId: string, blueprintId: string): Promise<void> {
    await db
      .update(users)
      .set({
        execution_state: "NORMAL",
        first_login_after_upgrade: false,
        onboarding_complete: true,
        active_blueprint_id: blueprintId,
      })
      .where(eq(users.id, userId));
  },
};
