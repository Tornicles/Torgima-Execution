#!/usr/bin/env node
/**
 * Execution lifecycle verification (5–8 task contract).
 * Requires DATABASE_URL and a seeded blueprint chain (plans → actions).
 *
 *   DATABASE_URL=postgresql://... pnpm exec tsx scripts/verify-lifecycle.ts
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const API_SRC = path.join(REPO_ROOT, "artifacts/api-server/src");

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

function fail(msg: string): never {
  process.stderr.write(`FAIL: ${msg}\n`);
  process.exit(1);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function poll<T>(
  label: string,
  fn: () => Promise<T | null | undefined>,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const intervalMs = opts.intervalMs ?? 400;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v != null && (typeof v !== "number" || v > 0)) return v as T;
    await sleep(intervalMs);
  }
  fail(`${label} — timed out after ${timeoutMs}ms`);
}

async function loadEnv() {
  const dotenv = await import("dotenv");
  dotenv.config({ path: path.join(REPO_ROOT, ".env.local") });
  dotenv.config({ path: path.join(REPO_ROOT, ".env") });
  if (!process.env.DATABASE_URL) fail("DATABASE_URL is required");
}

async function importApi<T>(rel: string): Promise<T> {
  const full = path.join(API_SRC, rel);
  if (!existsSync(full)) fail(`Missing module ${rel}`);
  return import(pathToFileURL(full).href) as Promise<T>;
}

async function main() {
  await loadEnv();

  const dbMod = await import("@workspace/db");
  const { db, orders, blueprints, enforcementPackages, signalSnapshots, conditions } = dbMod;
  const { eq, and, inArray, desc, sql } = await import("drizzle-orm");

  const { seedGapG9Fixture } = await import("./seedTestFixtures.js");
  const { guaranteeTask } = await importApi<{
    guaranteeTask: (p: unknown) => Promise<{ state: string }>;
  }>("engines/task-guarantee/ContinuousTaskGuaranteeEngine.js");
  const { generate } = await importApi<{
    generate: (p: unknown) => Promise<{ orders_generated: number; order_ids: string[] }>;
  }>("engines/task-generation/TaskGenerationEngine.js");
  const { processFeedback } = await importApi<{
    processFeedback: (p: unknown) => Promise<unknown>;
  }>("engines/feedback/FeedbackProcessingEngine.js");
  const { dispatchPendingEvents } = await importApi<{
    dispatchPendingEvents: () => Promise<number>;
  }>("services/EventDispatcher.js");
  const { parseTaskLimits, computeDailyMidpoint } = await importApi<{
    parseTaskLimits: (r: unknown) => { min: number; max: number };
    computeDailyMidpoint: (l: { min: number; max: number }) => number;
  }>("engines/task-generation/taskLimits.js");
  const fx = await seedGapG9Fixture();
  if (!fx.blueprintId) fail("seed fixture missing blueprintId");

  log("TEST 4A — initial task generation (blueprint_launched)");
  await guaranteeTask({
    blueprintId: fx.blueprintId,
    userId: fx.userId,
    generationMode: "initial",
    generationTrigger: "blueprint_launched",
    queueFill: true,
  }).catch((e: Error) => fail(`initial guarantee: ${e.message}`));

  await dispatchPendingEvents().catch(() => null);

  const initialCount = await poll(
    "initial pending orders",
    async () => {
      const [{ c } = { c: 0 }] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(orders)
        .where(
          and(
            eq(orders.blueprint_id, fx.blueprintId),
            eq(orders.user_id, fx.userId),
            inArray(orders.status, ["pending", "active"]),
          ),
        );
      return (c ?? 0) >= 3 ? c : null;
    },
  );

  const titles = await db
    .select({ title: orders.title })
    .from(orders)
    .where(eq(orders.blueprint_id, fx.blueprintId))
    .limit(5);
  log(`  pending tasks: ${initialCount}; sample titles: ${titles.map((t) => t.title).join(" | ")}`);
  if ((initialCount ?? 0) < 3) fail("expected >= 3 pending orders after launch");

  log("TEST 4B — feedback → signal → next tasks");
  const [firstOrder] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, fx.blueprintId),
        eq(orders.user_id, fx.userId),
        inArray(orders.status, ["pending", "active"]),
      ),
    )
    .limit(1);

  if (!firstOrder?.id) fail("no order for feedback test");

  await processFeedback({
    orderId: firstOrder.id,
    userId: fx.userId,
    blueprintId: fx.blueprintId,
    completionStatus: "completed",
    score: 8,
    reflection: "Task was completed successfully with measurable output.",
    idempotencyKey: `verify-lifecycle:${firstOrder.id}`,
  }).catch((e: Error) => fail(`processFeedback: ${e.message}`));

  for (let i = 0; i < 8; i++) {
    await dispatchPendingEvents().catch(() => null);
    await sleep(500);
  }

  const [snap] = await db
    .select({ id: signalSnapshots.id })
    .from(signalSnapshots)
    .where(eq(signalSnapshots.blueprint_id, fx.blueprintId))
    .orderBy(desc(signalSnapshots.created_at))
    .limit(1);
  if (!snap) fail("no signal_snapshot after feedback");

  const [cond] = await db
    .select({ id: conditions.id })
    .from(conditions)
    .where(and(eq(conditions.blueprint_id, fx.blueprintId), eq(conditions.is_current, true)))
    .limit(1);
  if (!cond) fail("no current condition after feedback");

  const [pkg] = await db
    .select({ task_limits: enforcementPackages.task_limits })
    .from(enforcementPackages)
    .where(
      and(eq(enforcementPackages.blueprint_id, fx.blueprintId), eq(enforcementPackages.is_current, true)),
    )
    .limit(1);
  if (!pkg) fail("no current enforcement_package after feedback");

  const limits = parseTaskLimits(pkg.task_limits);
  const afterFeedback = await poll("post-feedback pending orders", async () => {
    const [{ c } = { c: 0 }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, fx.blueprintId),
          eq(orders.user_id, fx.userId),
          inArray(orders.status, ["pending", "active"]),
        ),
      );
    if ((c ?? 0) >= limits.min) return c;
    return null;
  });

  if ((afterFeedback ?? 0) > limits.max) {
    fail(`post-feedback task count ${afterFeedback} > max ${limits.max}`);
  }
  log(`  tasks after loop: ${afterFeedback} (limits ${limits.min}-${limits.max})`);

  log("TEST 4C — daily cycle top-up");
  await db
    .update(orders)
    .set({ status: "completed" })
    .where(
      and(
        eq(orders.blueprint_id, fx.blueprintId),
        eq(orders.user_id, fx.userId),
        inArray(orders.status, ["pending", "active"]),
      ),
    );

  await guaranteeTask({
    blueprintId: fx.blueprintId,
    userId: fx.userId,
    generationMode: "daily",
    generationTrigger: "daily_cycle",
  }).catch((e: Error) => fail(`daily guarantee: ${e.message}`));

  const midpoint = computeDailyMidpoint(limits);
  const afterDaily = await poll("daily top-up", async () => {
    const [{ c } = { c: 0 }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, fx.blueprintId),
          eq(orders.user_id, fx.userId),
          inArray(orders.status, ["pending", "active"]),
        ),
      );
    return (c ?? 0) >= Math.min(midpoint, limits.min) ? c : null;
  });

  if ((afterDaily ?? 0) < limits.min || (afterDaily ?? 0) > limits.max) {
    fail(`daily count ${afterDaily} outside ${limits.min}-${limits.max}`);
  }
  log(`  daily tasks: ${afterDaily}`);

  log("TEST 4D — task count by condition");
  const cases: Array<{ condition: string; min: number; max: number }> = [
    { condition: "nothingness", min: 2, max: 3 },
    { condition: "danger", min: 2, max: 3 },
    { condition: "urgency", min: 3, max: 5 },
    { condition: "stability", min: 5, max: 7 },
    { condition: "power", min: 6, max: 8 },
    { condition: "affluence", min: 6, max: 8 },
  ];

  for (const c of cases) {
    await db
      .update(blueprints)
      .set({ current_condition: c.condition })
      .where(eq(blueprints.id, fx.blueprintId));

    await db
      .update(enforcementPackages)
      .set({ is_current: false })
      .where(eq(enforcementPackages.blueprint_id, fx.blueprintId));

    await db.insert(enforcementPackages).values({
      blueprint_id: fx.blueprintId,
      user_id: fx.userId,
      condition: c.condition,
      is_current: true,
      task_limits: { min: c.min, max: c.max },
      difficulty_cap: "moderate",
      allowed_actions: ["task_execution"],
      blocked_actions: [],
      ai_mode: "command",
      ui_mode: "standard",
    });

    await db
      .update(orders)
      .set({ status: "completed" })
      .where(
        and(
          eq(orders.blueprint_id, fx.blueprintId),
          inArray(orders.status, ["pending", "active"]),
        ),
      );

    const gen = await generate({
      blueprintId: fx.blueprintId,
      userId: fx.userId,
      generationMode: "post_feedback",
      generationTrigger: "manual_force",
      queueFill: true,
    }).catch((e: Error) => {
      log(`  ${c.condition}: generation error ${e.message}`);
      return { orders_generated: 0, order_ids: [] };
    });

    if (gen.orders_generated < c.min || gen.orders_generated > c.max) {
      fail(
        `${c.condition}: generated ${gen.orders_generated}, expected ${c.min}-${c.max}`,
      );
    }
    log(`  ${c.condition}: generated ${gen.orders_generated} (ok)`);
  }

  log("All lifecycle verification tests passed.");
}

const FIXTURE_EMAIL = "gap-g9-acceptance@torgima-test.local";

async function cleanupFixtureUser() {
  const dbMod = await import("@workspace/db");
  const { db, users } = dbMod;
  const { eq } = await import("drizzle-orm");
  await db.delete(users).where(eq(users.email, FIXTURE_EMAIL)).catch(() => null);
}

main()
  .then(() => cleanupFixtureUser())
  .catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    cleanupFixtureUser().finally(() => process.exit(1));
  });
