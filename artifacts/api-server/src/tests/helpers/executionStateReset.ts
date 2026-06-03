/**
 * Reset execution state for a user so they can start a new goal (keeps account + login).
 */
import {
  db,
  users,
  blueprints,
  events,
  eventLogs,
  deadLetterEvents,
  rewardEvents,
  userIdentityStates,
  behaviorPatterns,
  behaviorEvents,
  validations,
  sessions,
  magicLinkTokens,
  bhudhiLogs,
  validationRuns,
  validationMemory,
  taskGenerationLog,
  taskGenerationLogs,
  capabilityProfiles,
} from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";

const BLUEPRINT_PURGE_PASSES = 6;

async function listBlueprintChildTables(): Promise<string[]> {
  const rows = await db.execute<{ name: string }>(sql`
    SELECT DISTINCT c.table_name AS name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'blueprint_id'
      AND c.table_name <> 'blueprints'
    ORDER BY c.table_name
  `);
  return rows.rows.map((r) => r.name);
}

async function purgeBlueprintScopedRows(blueprintIds: string[]): Promise<void> {
  if (blueprintIds.length === 0) return;
  const childTables = await listBlueprintChildTables();

  const inClause = blueprintIds.map((id) => `'${id}'`).join(",");

  for (let pass = 0; pass < BLUEPRINT_PURGE_PASSES; pass++) {
    for (const table of childTables) {
      try {
        await db.execute(
          sql.raw(
            `DELETE FROM "${table.replace(/"/g, '""')}" WHERE blueprint_id IN (${inClause})`,
          ),
        );
      } catch {
        // FK ordering varies; later passes clear remaining rows.
      }
    }
    try {
      await db.delete(blueprints).where(inArray(blueprints.id, blueprintIds));
      return;
    } catch (err) {
      const code = (err as { cause?: { code?: string } })?.cause?.code;
      if (code !== "23503" || pass === BLUEPRINT_PURGE_PASSES - 1) throw err;
    }
  }
}

export async function resetUserExecutionState(userId: string): Promise<void> {
  const bps = await db.select({ id: blueprints.id }).from(blueprints).where(eq(blueprints.user_id, userId));
  const blueprintIds = bps.map((b) => b.id);

  const userEvents = await db.select({ id: events.id }).from(events).where(eq(events.user_id, userId));
  const eventIds = userEvents.map((e) => e.id);

  if (eventIds.length > 0) {
    await db.delete(deadLetterEvents).where(inArray(deadLetterEvents.original_event_id, eventIds));
    await db.delete(eventLogs).where(inArray(eventLogs.event_id, eventIds));
    await db.delete(events).where(inArray(events.id, eventIds));
  }

  const patternRows = await db
    .select({ id: behaviorPatterns.id })
    .from(behaviorPatterns)
    .where(eq(behaviorPatterns.user_id, userId));
  const patternIds = patternRows.map((p) => p.id);
  if (patternIds.length > 0) {
    await db.delete(behaviorEvents).where(inArray(behaviorEvents.pattern_id, patternIds));
  }
  await db.delete(behaviorEvents).where(eq(behaviorEvents.user_id, userId));
  await db.delete(behaviorPatterns).where(eq(behaviorPatterns.user_id, userId));

  await db
    .update(users)
    .set({ active_blueprint_id: null })
    .where(eq(users.id, userId));
  await db
    .update(capabilityProfiles)
    .set({ blueprint_id: null })
    .where(eq(capabilityProfiles.user_id, userId));

  await db.delete(validationRuns).where(eq(validationRuns.user_id, userId));

  if (blueprintIds.length > 0) {
    await db.delete(validationMemory).where(inArray(validationMemory.blueprint_id, blueprintIds));
    await db.delete(taskGenerationLog).where(inArray(taskGenerationLog.blueprint_id, blueprintIds));
    await db.delete(taskGenerationLogs).where(inArray(taskGenerationLogs.blueprint_id, blueprintIds));
    await db.delete(events).where(inArray(events.blueprint_id, blueprintIds));
    await purgeBlueprintScopedRows(blueprintIds);
  }
  await db.delete(validationMemory).where(eq(validationMemory.user_id, userId));
  await db.delete(validations).where(eq(validations.user_id, userId));
  await db.delete(userIdentityStates).where(eq(userIdentityStates.user_id, userId));
  await db.delete(rewardEvents).where(eq(rewardEvents.user_id, userId));
  await db.delete(bhudhiLogs).where(eq(bhudhiLogs.user_id, userId));
  await db.delete(sessions).where(eq(sessions.user_id, userId));
  await db.delete(magicLinkTokens).where(eq(magicLinkTokens.user_id, userId));

  await db
    .update(users)
    .set({
      onboarding_complete: false,
      active_blueprint_id: null,
      execution_state: "NORMAL",
      first_login_after_upgrade: false,
    })
    .where(eq(users.id, userId));
}

export async function resetUsersByEmail(emails: string[]): Promise<{ results: Array<{ email: string; userId?: string; ok: boolean; error?: string }> }> {
  const results: Array<{ email: string; userId?: string; ok: boolean; error?: string }> = [];
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!email) continue;
    try {
      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        results.push({ email, ok: false, error: "user not found" });
        continue;
      }
      await resetUserExecutionState(user.id);
      results.push({ email, userId: user.id, ok: true });
    } catch (e) {
      results.push({ email, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { results };
}

export async function listKnownUserEmails(extra: string[] = []): Promise<string[]> {
  const fromEnv = (process.env.RESET_USER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const doc36 = process.env.DOC36_TEST_EMAIL?.trim().toLowerCase();
  const set = new Set<string>([...fromEnv, ...extra.map((e) => e.trim().toLowerCase())]);
  if (doc36) set.add(doc36);
  return [...set];
}

export async function resetAllNonAdminUsers(): Promise<number> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const rows = await db.select({ id: users.id, email: users.email }).from(users);
  let count = 0;
  for (const row of rows) {
    if (adminEmail && row.email.toLowerCase() === adminEmail) continue;
    await resetUserExecutionState(row.id);
    count++;
  }
  return count;
}
