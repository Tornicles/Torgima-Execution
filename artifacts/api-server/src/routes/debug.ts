import { Router } from "express";
import {
  db,
  blueprints,
  users,
  orders,
  feedback,
  signalSnapshots,
  conditions,
  blueprintFrameworkSignals,
  events,
  enforcementPackages,
} from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { requireAuth, withAuth } from "../lib/auth.js";
import { success, handleError } from "../lib/utils.js";
import { logger } from "../lib/logger.js";
import { BlueprintStatus, EventStatus, OrderStatus } from "@workspace/state-machine";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { guaranteeTask } from "../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { parseTaskLimits } from "../engines/task-generation/taskLimits.js";

const router = Router();

/** Deploy diagnostics under /api/debug/* — internal auth only (x-internal-auth). */
router.use("/debug", withAuth("INTERNAL_SERVICE"));

/**
 * GET /api/v1/debug/system-state — BHUDHI deploy diagnostic (counts + active blueprint).
 */
router.get("/v1/debug/system-state", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");

    const [
      userCountRow,
      blueprintCountRow,
      orderCountRow,
      feedbackCountRow,
      signalCountRow,
      frameworkSignalCountRow,
    ] = await Promise.all([
      db.select({ c: sql<number>`count(*)::int` }).from(users),
      db.select({ c: sql<number>`count(*)::int` }).from(blueprints),
      db.select({ c: sql<number>`count(*)::int` }).from(orders),
      db.select({ c: sql<number>`count(*)::int` }).from(feedback),
      db.select({ c: sql<number>`count(*)::int` }).from(signalSnapshots),
      db.select({ c: sql<number>`count(*)::int` }).from(blueprintFrameworkSignals),
    ]);

    const [activeBlueprint] = await db
      .select({
        id: blueprints.id,
        status: blueprints.status,
        current_condition: blueprints.current_condition,
        goal_final: blueprints.goal_final,
        purpose_final: blueprints.purpose_final,
        raw_goal_input: blueprints.raw_goal_input,
        economic_type: blueprints.economic_type,
        refinement_status: blueprints.refinement_status,
      })
      .from(blueprints)
      .where(eq(blueprints.active, true))
      .orderBy(desc(blueprints.created_at))
      .limit(1);

    const pendingOrders = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        activeBlueprint
          ? and(
              eq(orders.blueprint_id, activeBlueprint.id),
              inArray(orders.status, ["pending", "pre_generated"]),
            )
          : sql`false`,
      );

    const [currentCondition] = activeBlueprint
      ? await db
          .select()
          .from(conditions)
          .where(
            and(eq(conditions.blueprint_id, activeBlueprint.id), eq(conditions.is_current, true)),
          )
          .limit(1)
      : [];

    const recentFramework = activeBlueprint
      ? await db
          .select({
            signal_key: blueprintFrameworkSignals.signal_key,
            value: blueprintFrameworkSignals.value,
            momentum: blueprintFrameworkSignals.momentum,
            updated_at: blueprintFrameworkSignals.updated_at,
          })
          .from(blueprintFrameworkSignals)
          .where(eq(blueprintFrameworkSignals.blueprint_id, activeBlueprint.id))
      : [];

    const payload = {
      counts: {
        userCount: userCountRow[0]?.c ?? 0,
        blueprintCount: blueprintCountRow[0]?.c ?? 0,
        orderCount: orderCountRow[0]?.c ?? 0,
        feedbackCount: feedbackCountRow[0]?.c ?? 0,
        signalCount: signalCountRow[0]?.c ?? 0,
        frameworkSignalCount: frameworkSignalCountRow[0]?.c ?? 0,
      },
      activeBlueprint,
      pendingOrders: pendingOrders[0]?.c ?? 0,
      currentCondition: currentCondition ?? null,
      frameworkSignals: recentFramework,
    };

    logger.info({ diagnostic: payload }, "[DIAGNOSTIC] system-state");
    success(res, payload);
  } catch (err) {
    handleError(req, res, err);
  }
});

/**
 * GET /api/v1/debug/loop-state
 * Diagnostic snapshot for the execution loop (auth required).
 */
router.get("/v1/debug/loop-state", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const [blueprint] = await db
      .select({
        id: blueprints.id,
        status: blueprints.status,
        active: blueprints.active,
        current_condition: blueprints.current_condition,
        goal: blueprints.goal,
        created_at: blueprints.created_at,
      })
      .from(blueprints)
      .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
      .orderBy(desc(blueprints.created_at))
      .limit(1);

    const blueprintId = blueprint?.id ?? "";

    const orderRows = blueprintId
      ? await db
          .select({
            id: orders.id,
            status: orders.status,
            title: orders.title,
            generation_reason: orders.generation_reason,
            task_type: orders.task_type,
            created_at: orders.created_at,
          })
          .from(orders)
          .where(eq(orders.blueprint_id, blueprintId))
          .orderBy(desc(orders.created_at))
      : [];

    const ordersByStatus = orderRows.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {});

    const feedbackRows = await db
      .select({
        id: feedback.id,
        order_id: feedback.order_id,
        completion_status: feedback.completion_status,
        created_at: feedback.created_at,
      })
      .from(feedback)
      .where(eq(feedback.user_id, auth.userId))
      .orderBy(desc(feedback.created_at))
      .limit(20);

    const signalRows = blueprintId
      ? await db
          .select({
            id: signalSnapshots.id,
            assigned_condition: signalSnapshots.assigned_condition,
            created_at: signalSnapshots.created_at,
          })
          .from(signalSnapshots)
          .where(eq(signalSnapshots.blueprint_id, blueprintId))
          .orderBy(desc(signalSnapshots.created_at))
          .limit(5)
      : [];

    const [enforcementPkg] = blueprintId
      ? await db
          .select({
            id: enforcementPackages.id,
            task_limits: enforcementPackages.task_limits,
            difficulty_cap: enforcementPackages.difficulty_cap,
            phase_permission: enforcementPackages.phase_permission,
            condition: enforcementPackages.condition,
          })
          .from(enforcementPackages)
          .where(
            and(
              eq(enforcementPackages.blueprint_id, blueprintId),
              eq(enforcementPackages.is_current, true),
            ),
          )
          .limit(1)
      : [undefined];

    const limits = parseTaskLimits(enforcementPkg?.task_limits);

    const pendingEvents = await db
      .select({
        id: events.id,
        event_type: events.event_type,
        status: events.status,
        created_at: events.created_at,
      })
      .from(events)
      .where(
        and(
          eq(events.user_id, auth.userId),
          inArray(events.status, [EventStatus.PENDING, EventStatus.RETRY_PENDING]),
        ),
      )
      .orderBy(desc(events.created_at))
      .limit(20);

    const payload = {
      blueprint: blueprint
        ? {
            id: blueprint.id,
            status: blueprint.status,
            active: blueprint.active,
            condition: blueprint.current_condition,
            tier: null,
            goal: blueprint.goal?.slice(0, 120),
            created_at: blueprint.created_at,
          }
        : null,
      orders_total: orderRows.length,
      orders_by_status: ordersByStatus,
      orders_list: orderRows.slice(0, 10).map((o) => ({
        id: o.id.slice(0, 8),
        title: o.title?.slice(0, 40),
        status: o.status,
        generation_reason: o.generation_reason,
      })),
      pending_actionable_orders: orderRows.filter(
        (o) => o.status === OrderStatus.PENDING || o.status === OrderStatus.ACTIVE,
      ).length,
      feedbacks_total: feedbackRows.length,
      feedbacks: feedbackRows,
      signals_total: signalRows.length,
      signals: signalRows,
      enforcement: enforcementPkg
        ? {
            id: enforcementPkg.id,
            task_limit_min: limits.min,
            task_limit_max: limits.max,
            difficulty_cap: enforcementPkg.difficulty_cap,
            phase_permission: enforcementPkg.phase_permission,
            condition: enforcementPkg.condition,
          }
        : null,
      pending_events_count: pendingEvents.length,
      pending_events: pendingEvents,
      blueprint_status_active: blueprint?.status === BlueprintStatus.ACTIVE,
    };

    logger.info({ userId: auth.userId, loopDiagnostic: payload }, "[LOOP DIAGNOSTIC]");

    success(res, payload);
  } catch (err) {
    handleError(req, res, err);
  }
});

/**
 * POST /api/v1/debug/force-generate
 * Queue task generation for the active blueprint (fills queue up to enforcement max).
 */
router.post("/v1/debug/force-generate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const [blueprint] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
      .orderBy(desc(blueprints.created_at))
      .limit(1);

    if (!blueprint) {
      success(res, { ok: false, error: "No active blueprint" }, 404);
      return;
    }

    const count =
      typeof (req.body as { count?: number })?.count === "number"
        ? Math.min(8, Math.max(1, Math.round((req.body as { count: number }).count)))
        : 5;

    await writeEvent({
      eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
      entityType: "blueprint",
      entityId: blueprint.id,
      userId: auth.userId,
      blueprintId: blueprint.id,
      payload: {
        generation_mode: "post_feedback",
        generation_trigger: "manual_force",
        queue_fill: true,
        count,
      },
      idempotencyKey: `debug_force_gen:${blueprint.id}:${Date.now()}`,
    });

    const result = await guaranteeTask({
      blueprintId: blueprint.id,
      userId: auth.userId,
      generationMode: "post_feedback",
      generationTrigger: "manual_force",
      queueFill: true,
      targetCount: count,
    });

    success(res, {
      ok: true,
      blueprint_id: blueprint.id,
      guarantee_state: result.state,
      order_id: result.orderId,
      requested_count: count,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

/**
 * GET /api/v1/debug/complete-diagnostic
 * Full TORGIMA_COMPLETE_DIAGNOSTIC_PROMPT audit (PART A–J). Auth required.
 * Query: ?probeDb=1 to run live Supabase probes when DATABASE_URL is set.
 */
router.get("/v1/debug/complete-diagnostic", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const probeDb = req.query.probeDb === "1" || req.query.probeDb === "true";
    const { runCompleteSystemDiagnostic, formatDiagnosticReportMarkdown } = await import(
      "../diagnostics/completeSystemDiagnostic.js"
    );
    const report = await runCompleteSystemDiagnostic({ probeDatabase: probeDb });
    const format = req.query.format === "markdown" ? "markdown" : "json";
    if (format === "markdown") {
      res.type("text/markdown").send(formatDiagnosticReportMarkdown(report));
      return;
    }
    success(res, report);
  } catch (err) {
    handleError(req, res, err);
  }
});

/**
 * GET /api/debug/cloudflare-env — present/missing env (no secret values).
 */
router.get("/debug/cloudflare-env", (_req, res) => {
  const keys = [
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ANTHROPIC_API_KEY",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "INTERNAL_AUTH_SECRET",
    "NOTIFICATION_UNSUBSCRIBE_SECRET",
    "NODE_ENV",
    "TORGIMA_RUNTIME",
    "APP_URL",
    "FRONTEND_URL",
  ] as const;
  const env: Record<string, "present" | "missing"> = {};
  for (const key of keys) {
    const val = process.env[key];
    env[key] = typeof val === "string" && val.trim() ? "present" : "missing";
  }
  const allRequiredPresent = keys.every((key) => env[key] === "present");
  success(res, {
    ok: allRequiredPresent,
    env,
    runtime: process.env.TORGIMA_RUNTIME ?? "unknown",
    kv_sessions: globalThis.__TORGIMA_SESSIONS_KV__ ? "bound" : "missing",
  });
});

/**
 * GET /api/debug/db-target — diagnose WHY the DB connection fails (internal auth only).
 * Returns the masked connection target (host/port/pooler/ssl) and the exact raw error
 * from a live `SELECT 1`, with elapsed time. Never returns credentials.
 *
 * Reading the result:
 *  - ~10s elapsed + timeout error  -> host:port UNREACHABLE (paused project, or direct URL not pooler)
 *  - <1s + "password"/"role"       -> wrong credentials / wrong pooler username (postgres.<ref>)
 *  - <1s + "SSL"/"tls"             -> SSL/TLS handshake problem
 *  - ok:true                       -> DB reachable; failure is elsewhere
 */
router.get("/debug/db-target", async (_req, res) => {
  const raw = process.env.DATABASE_URL?.trim();
  const target: Record<string, unknown> = { configured: Boolean(raw) };

  if (raw) {
    try {
      const parsed = new URL(raw.replace(/^postgresql:/i, "postgres:"));
      const host = parsed.hostname;
      target.host = host;
      target.port = parsed.port || "(default 5432)";
      target.isPooler = host.includes("pooler.supabase.com");
      target.isDirectSupabase = /\.supabase\.co$/i.test(host);
      target.username = parsed.username
        ? `${parsed.username.slice(0, 9)}***`
        : "(none)";
      target.usernameHasProjectRef = parsed.username.includes(".");
      target.sslmode = parsed.searchParams.get("sslmode") ?? "(unset → require)";
      target.pgbouncer = parsed.searchParams.get("pgbouncer") ?? "(unset)";
    } catch {
      target.parseError = "DATABASE_URL is not a valid URL";
    }
  }

  let dbOk = false;
  let dbError: string | null = null;
  let elapsedMs = 0;
  if (raw) {
    const started = Date.now();
    try {
      await db.execute(sql.raw("select 1 as ok"));
      dbOk = true;
    } catch (err) {
      dbError = err instanceof Error ? err.message : String(err);
    } finally {
      elapsedMs = Date.now() - started;
    }
  }

  success(res, {
    ok: dbOk,
    target,
    probe: { ok: dbOk, error: dbError, elapsedMs },
    hint: dbOk
      ? "Database reachable — the timeout is not here."
      : elapsedMs >= 8000
        ? "Connect timed out: host:port unreachable from the Worker. Check (1) Supabase project paused/restricted, (2) DATABASE_URL must be the Transaction Pooler (*.pooler.supabase.com:6543, user postgres.<ref>), NOT the direct db.<ref>.supabase.co:5432."
        : "Fast failure: likely credentials/SSL — inspect the error string above.",
    runtime: process.env.TORGIMA_RUNTIME ?? "unknown",
  });
});

/**
 * GET /api/debug/routes — deploy smoke list (internal auth required).
 */
router.get("/debug/routes", (_req, res) => {
  success(res, {
    ok: true,
    routes: [
      "GET /health",
      "GET /api/health",
      "GET /api/debug/routes",
      "GET /api/debug/cloudflare-env",
      "GET /api/debug/db-target",
      "GET /api/debug/blueprint-launch-health",
      "POST /api/v1/validations",
      "GET /api/v1/validations/:id",
      "POST /api/v1/validations/:id/launch",
      "POST /api/v1/blueprints",
      "GET /api/v1/orders/today",
      "GET /api/v1/signals/current",
    ],
  });
});

/**
 * GET /api/debug/blueprint-launch-health — launch prerequisites (no secrets).
 */
router.get("/debug/blueprint-launch-health", async (_req, res) => {
  let databaseConnected = false;
  let databaseError: string | null = null;
  if (process.env.DATABASE_URL?.trim()) {
    try {
      const { checkDatabaseConnection } = await import("./health.js");
      await checkDatabaseConnection();
      databaseConnected = true;
    } catch (err) {
      databaseError = err instanceof Error ? err.message : String(err);
    }
  }

  success(res, {
    ok: true,
    launch_route: "POST /api/v1/validations/:id/launch",
    database_configured: Boolean(process.env.DATABASE_URL?.trim()),
    database_connected: databaseConnected,
    database_error: databaseError,
    auth_available: Boolean(
      process.env.INTERNAL_AUTH_SECRET?.trim() || process.env.INTERNAL_SERVICE_SECRET?.trim(),
    ),
    anthropic_configured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    resend_configured: Boolean(process.env.RESEND_API_KEY?.trim()),
    runtime: process.env.TORGIMA_RUNTIME ?? "unknown",
  });
});

export default router;
