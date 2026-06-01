/**
 * End-to-end signal chain diagnostic — compares calculated vs stored condition.
 * Usage: DATABASE_URL="postgres://..." npx tsx scripts/diagnose-signal-chain.ts
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const API_SRC = path.join(REPO_ROOT, "artifacts/api-server/src");

async function loadModules() {
  const signal = await import(
    pathToFileURL(path.join(API_SRC, "engines/signal/SignalCalculationEngine.js")).href
  );
  const matrix = await import(
    pathToFileURL(path.join(API_SRC, "engines/signal/ConditionMetricMatrix.js")).href
  );
  const limits = await import(pathToFileURL(path.join(API_SRC, "engines/task-generation/taskLimits.js")).href);
  const dbMod = await import("@workspace/db");
  const orm = await import("drizzle-orm");
  return { signal, matrix, limits, dbMod, orm };
}

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function passFail(ok: boolean): string {
  return ok ? "PASS" : "FAIL";
}

async function main(): Promise<void> {
  const envLocal = path.join(REPO_ROOT, ".env.local");
  if (existsSync(envLocal)) {
    const { config } = await import("dotenv");
    config({ path: envLocal });
  } else {
    const { config } = await import("dotenv");
    config();
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const { signal, matrix, limits: limitsMod, dbMod, orm } = await loadModules();
  const { calculateMetrics } = signal;
  const { assignConditionFromMetricMatrix } = matrix;
  const { parseTaskLimits } = limitsMod;
  const { db, blueprints, feedback, signalSnapshots, conditions, enforcementPackages, orders, actions } =
    dbMod;
  const { and, desc, eq, gte, lt } = orm;

  const [bp] = await db
    .select()
    .from(blueprints)
    .where(eq(blueprints.status, "active"))
    .orderBy(desc(blueprints.updated_at))
    .limit(1);

  if (!bp) {
    console.log("=== TORGIMA SIGNAL CHAIN DIAGNOSTIC ===\nNo active blueprint found.");
    process.exit(0);
  }

  const blueprintId = bp.id;
  const userId = bp.user_id;
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS);
  const priorStart = new Date(windowStart.getTime() - WINDOW_MS);

  const [snap] = await db
    .select()
    .from(signalSnapshots)
    .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)))
    .limit(1);

  const [cond] = await db
    .select()
    .from(conditions)
    .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)))
    .limit(1);

  const [enf] = await db
    .select()
    .from(enforcementPackages)
    .where(and(eq(enforcementPackages.blueprint_id, blueprintId), eq(enforcementPackages.is_current, true)))
    .limit(1);

  const recentFeedback = await db
    .select()
    .from(feedback)
    .where(eq(feedback.blueprint_id, blueprintId))
    .orderBy(desc(feedback.created_at))
    .limit(5);

  const feedbackInWindow = await db
    .select()
    .from(feedback)
    .where(and(eq(feedback.blueprint_id, blueprintId), gte(feedback.created_at, windowStart)));

  const priorFeedback = await db
    .select()
    .from(feedback)
    .where(
      and(
        eq(feedback.blueprint_id, blueprintId),
        gte(feedback.created_at, priorStart),
        lt(feedback.created_at, windowStart),
      ),
    );

  const metrics = calculateMetrics(feedbackInWindow, priorFeedback);
  const calculated = assignConditionFromMetricMatrix(metrics, snap?.assigned_condition ?? "nothingness");

  const gamingCount = feedbackInWindow.filter((f) => f.gaming_flag).length;
  const gamingRatio = feedbackInWindow.length ? gamingCount / feedbackInWindow.length : 0;

  const pendingOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.blueprint_id, blueprintId), eq(orders.status, "pending")));

  const limits = enf ? parseTaskLimits(enf.task_limits) : { min: 0, max: 0 };
  const pendingCount = pendingOrders.length;
  const withinLimits = pendingCount >= limits.min && pendingCount <= limits.max;

  const [action] = bp.current_action_id
    ? await db.select().from(actions).where(eq(actions.id, bp.current_action_id)).limit(1)
    : [null];

  const problems: string[] = [];

  const snapCondition = snap?.assigned_condition ?? "—";
  const condMatch = calculated === snapCondition;
  if (!condMatch) problems.push("Calculated condition does not match signal snapshot");

  const condRecordMatch = (cond?.condition ?? snapCondition) === snapCondition;
  if (!condRecordMatch) problems.push("Condition record does not match snapshot");

  if (!enf) problems.push("No current enforcement package");

  if (enf && limits.min > 0 && !withinLimits && pendingCount > limits.max) {
    problems.push(`Pending orders (${pendingCount}) exceed enforcement max (${limits.max})`);
  }

  const feedbackToSignal =
    recentFeedback.length > 0 && recentFeedback.every((f) => f.weighted_score != null)
      ? "CONNECTED"
      : recentFeedback.some((f) => f.weighted_score == null)
        ? "BROKEN"
        : "CONNECTED";

  if (feedbackToSignal === "BROKEN") problems.push("Feedback missing weighted_score");

  console.log("=== TORGIMA SIGNAL CHAIN DIAGNOSTIC ===");
  console.log(`BLUEPRINT: ${blueprintId} — Goal: ${bp.goal?.slice(0, 80) ?? "(none)"}`);
  console.log(`Status: ${bp.status} | Domain: ${bp.current_domain ?? bp.domain ?? "—"}`);
  console.log("\n--- LAST 5 FEEDBACK RECORDS ---");
  for (const f of recentFeedback) {
    const w = f.confidence_weight ?? (f.score && f.weighted_score ? f.weighted_score / f.score : null);
    console.log(
      `[${f.created_at.toISOString().slice(0, 10)}]  Score: ${f.score}  Completion: ${f.completion_status}  Weight: ${w?.toFixed(2) ?? "—"}  Weighted: ${f.weighted_score?.toFixed(2) ?? "—"}  Gaming: ${f.gaming_flag}${f.gaming_flag ? "  ← flagged" : ""}`,
    );
  }

  console.log("\n--- SIGNAL CALCULATION (7-DAY WINDOW) ---");
  console.log(`Tasks in window:      ${metrics.tasks_in_window}`);
  console.log(
    `Completion rate:      ${Math.round(metrics.completion_rate * 100)}%   (completed+partial / total)`,
  );
  console.log(`Weighted score:       ${metrics.weighted_score.toFixed(1)}  (avg of weighted_score column)`);
  console.log(`Momentum:             ${metrics.momentum} days`);
  console.log(`Trend:                ${metrics.trend}`);
  console.log(`Confidence:           ${metrics.confidence}`);
  console.log(
    `Gaming ratio:         ${Math.round(gamingRatio * 100)}%   (${gamingCount} of ${feedbackInWindow.length} records flagged)`,
  );

  const cr = metrics.completion_rate;
  const ws = metrics.weighted_score;
  console.log("\n--- CONDITION FORMULA ---");
  console.log(
    `Step 1: completion_rate ${Math.round(cr * 100)}% vs nothingness threshold (<10%): ${passFail(!(cr < 0.1 && ws < 2))}`,
  );
  console.log(
    `Step 2: completion_rate ${Math.round(cr * 100)}% vs danger threshold (<30%): ${passFail(cr >= 0.3 || ws >= 4)}`,
  );
  console.log(
    `Step 3: completion_rate ${Math.round(cr * 100)}% vs urgency range (30-50%): ${passFail(cr < 0.3 || cr >= 0.5 || ws < 4 || ws >= 5.5)}`,
  );
  console.log(
    `Step 4: completion_rate ${Math.round(cr * 100)}% + score ${ws.toFixed(1)} vs stability range: ${passFail(
      !(cr >= 0.5 && cr < 0.7 && ws >= 5.5 && ws < 7),
    )}`,
  );
  console.log(
    `Step 5: completion_rate ${Math.round(cr * 100)}% + score ${ws.toFixed(1)} + momentum ${metrics.momentum} vs power: ${passFail(
      !(cr >= 0.7 && cr < 0.85 && ws >= 7 && ws < 8.5 && metrics.momentum >= 3),
    )}`,
  );
  console.log(`Step 6: all metrics vs affluence: ${passFail(!(cr > 0.85 && ws > 8.5 && metrics.momentum >= 7))}`);
  console.log(`→ CALCULATED CONDITION: ${calculated}`);

  console.log("\n--- STORED STATE ---");
  console.log(`Signal snapshot condition:    ${snapCondition}`);
  console.log(`Match with calculated:        ${condMatch ? "YES" : "NO ← PROBLEM"}`);
  console.log(`Condition record (current):   ${cond?.condition ?? "—"}`);
  console.log(
    `Enforcement package (current): task_min=${limits.min} task_max=${limits.max} difficulty=${enf?.difficulty_cap ?? "—"}`,
  );

  console.log("\n--- CURRENT TASKS ---");
  console.log(`Pending orders: ${pendingCount}`);
  console.log(`Task types: ${[...new Set(pendingOrders.map((o) => o.task_type))].join(", ") || "—"}`);
  console.log(`Tasks within enforcement limits: ${withinLimits || limits.min === 0 ? "YES" : "NO ← PROBLEM if NO"}`);
  const linked = pendingOrders.every((o) => o.action_id != null || o.linked_project_id != null);
  console.log(`Each task linked to blueprint position: ${linked ? "YES" : "NO"}`);

  console.log("\n--- CHAIN STATUS ---");
  console.log(`Feedback → Signal:      ${feedbackToSignal}`);
  console.log(`Signal → Condition:     ${snap && cond ? "CONNECTED" : "BROKEN"}`);
  console.log(`Condition → Enforcement:${enf ? "CONNECTED" : "BROKEN"}`);
  console.log(`Enforcement → Tasks:    ${enf ? "CONNECTED" : "BROKEN"}`);
  console.log(`Tasks → Blueprint:      ${action ? "CONNECTED" : "BROKEN"}`);
  console.log(`Blueprint advancement:  active action: ${action?.name ?? "—"}`);

  console.log("\n--- PROBLEMS FOUND ---");
  if (problems.length === 0) {
    console.log("ALL CONNECTIONS VERIFIED — chain is working");
  } else {
    for (const p of problems) console.log(`- ${p}`);
  }

  process.exit(problems.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
