/**
 * Drizzle integration fixtures (Prompt 16). Use only when
 * `TORGIMA_INTEGRATION=true` and `DATABASE_URL` points at a real Postgres.
 */
import { db, users, blueprints, capabilityProfiles, orders, feedback, signalSnapshots, conditions, enforcementPackages, stateMemory } from "@workspace/db";
import { eq } from "drizzle-orm";

export function integrationEnabled(): boolean {
  const on =
    typeof process.env.TORGIMA_INTEGRATION === "string" &&
    ["1", "true", "yes"].includes(process.env.TORGIMA_INTEGRATION.toLowerCase());
  const url = process.env.DATABASE_URL ?? "";
  const fake = url.includes("vitest_stub");
  return Boolean(on && url && !fake);
}

export async function createTestUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@torgima-test.com`;
  const [user] = await db
    .insert(users)
    .values({
      email,
      display_name: "Test User",
      tier: "growth",
      mode: "individual",
      commitment_level: "medium",
      ...overrides,
    })
    .returning();

  if (!user) throw new Error("createTestUser: insert failed");

  await db.insert(capabilityProfiles).values({ user_id: user.id });

  return user;
}

export async function createTestBlueprint(userId: string, overrides: Partial<typeof blueprints.$inferInsert> = {}) {
  const [bp] = await db
    .insert(blueprints)
    .values({
      user_id: userId,
      goal: "Test goal: Launch a product with 100 paying customers in 90 days",
      purpose: "Build a revenue-generating business",
      status: "active",
      active: true,
      state_version: 1,
      current_domain: "delivery",
      current_condition: "urgency",
      ...overrides,
    })
    .returning();
  if (!bp) throw new Error("createTestBlueprint: insert failed");

  await db.update(capabilityProfiles).set({ blueprint_id: bp.id }).where(eq(capabilityProfiles.user_id, userId));

  return bp;
}

export async function createInitialState(blueprintId: string, userId: string) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 7 * 86400000);

  const [signal] = await db
    .insert(signalSnapshots)
    .values({
      blueprint_id: blueprintId,
      user_id: userId,
      window_start: windowStart,
      window_end: now,
      completion_rate: 0.5,
      weighted_score: 5.5,
      momentum: 3,
      trend: "stable",
      confidence: "medium",
      blocker_ratio: 0,
      skip_ratio: 0,
      assigned_condition: "urgency",
      is_current: true,
    })
    .returning();
  if (!signal) throw new Error("signal snapshot insert failed");

  const [condition] = await db
    .insert(conditions)
    .values({
      blueprint_id: blueprintId,
      user_id: userId,
      condition: "urgency",
      duration_days: 2,
      escalation_level: 0,
      recovery_required: false,
      is_current: true,
      signal_snapshot_id: signal.id,
    })
    .returning();
  if (!condition) throw new Error("condition insert failed");

  const [enforcement] = await db
    .insert(enforcementPackages)
    .values({
      blueprint_id: blueprintId,
      condition_id: condition.id,
      signal_snapshot_id: signal.id,
      condition: "urgency",
      task_limits: { min: 1, max: 2 },
      difficulty_cap: "easy",
      allowed_actions: ["task_execution", "feedback_submission"],
      blocked_actions: ["scaling_operations"],
      phase_permission: "restricted",
      ai_mode: "stabilization",
      ui_mode: "focused",
      is_current: true,
    })
    .returning();
  if (!enforcement) throw new Error("enforcement insert failed");

  await db.insert(stateMemory).values({
    blueprint_id: blueprintId,
    user_id: userId,
    condition: "urgency",
    entered_at: now,
    is_current: true,
    duration_days: 2,
    escalation_level: 0,
  });

  return { signal, condition, enforcement };
}

export async function createTestOrder(
  blueprintId: string,
  userId: string,
  overrides: Partial<typeof orders.$inferInsert> = {},
) {
  const [order] = await db
    .insert(orders)
    .values({
      blueprint_id: blueprintId,
      user_id: userId,
      task_type: "execution",
      title: "Test execution task",
      instruction: "Complete this test action toward your goal.",
      expected_output: "A completed deliverable.",
      definition_of_done: "Task is done and output exists.",
      why_it_matters: "Advances the blueprint.",
      difficulty: "easy",
      priority: 5,
      status: "pending",
      time_estimate_minutes: 30,
      ...overrides,
    })
    .returning();
  if (!order) throw new Error("createTestOrder: insert failed");
  return order;
}

export async function cleanupTestUser(userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}
