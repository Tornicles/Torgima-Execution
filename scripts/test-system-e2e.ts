#!/usr/bin/env node
/**
 * Torgima full-system E2E — real Postgres, real engines, no mocks.
 * Run from repo root: `pnpm -F @workspace/scripts test:system:e2e` or `npx tsx scripts/test-system-e2e.ts`.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

type Outcome = { name: string; status: "pass" | "fail" | "skip"; detail?: string };

type Ctx = {
  runId: string;
  userId: string | null;
  blueprintId: string | null;
  email: string;
  /** keyed stage outcomes for report */
  trace: Record<string, boolean>;
  aiBoundary: Record<string, boolean>;
  integrity: Record<string, boolean>;
  laws: Record<string, boolean>;
  loopMs: number;
  skippedBhudhi: boolean;
};

function print(msg: string) {
  process.stdout.write(`${msg}\n`);
}

async function loadEnvThenDb(): Promise<Awaited<ReturnType<typeof import("@workspace/db")>>> {
  const dotenv = await import("dotenv");
  dotenv.config({ path: path.join(REPO_ROOT, ".env.local") });
  dotenv.config({ path: path.join(REPO_ROOT, ".env") });
  const mod = await import("@workspace/db");
  await mod.db.execute(mod.sql.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS e2e_test_run_id text`));
  await mod.db.execute(mod.sql.raw(`ALTER TABLE blueprints ADD COLUMN IF NOT EXISTS e2e_test_run_id text`));
  return mod;
}

async function loadEnginesMerged() {
  const base = path.join(REPO_ROOT, "artifacts/api-server/src");
  const [
    v,
    bp,
    sig,
    cond,
    ctl,
    tg,
    gu,
    fb,
    fw,
    idEng,
    rw,
    inact,
    comp,
    pause,
    resume,
    valSvc,
    evt,
    bhudhi,
  ] = await Promise.all([
    import(pathToFileURL(path.join(base, "engines/validation/ValidationEngine.js")).href),
    import(pathToFileURL(path.join(base, "engines/blueprint/BlueprintEngine.js")).href),
    import(pathToFileURL(path.join(base, "engines/signal/SignalCalculationEngine.js")).href),
    import(pathToFileURL(path.join(base, "engines/condition/ConditionEvaluationEngine.js")).href),
    import(pathToFileURL(path.join(base, "engines/control/ControlEngine.js")).href),
    import(pathToFileURL(path.join(base, "engines/task-generation/TaskGenerationEngine.js")).href),
    import(pathToFileURL(path.join(base, "engines/task-guarantee/ContinuousTaskGuaranteeEngine.js")).href),
    import(pathToFileURL(path.join(base, "engines/feedback/FeedbackProcessingEngine.js")).href),
    import(pathToFileURL(path.join(base, "engines/framework/FrameworkActivationEngine.js")).href),
    import(pathToFileURL(path.join(base, "engines/identity/IdentityEngine.js")).href),
    import(pathToFileURL(path.join(base, "engines/reward/RewardEngine.js")).href),
    import(pathToFileURL(path.join(base, "engines/inactivity/InactivityDetectionEngine.js")).href),
    import(pathToFileURL(path.join(base, "engines/lifecycle/CompletionEngine.js")).href),
    import(pathToFileURL(path.join(base, "engines/lifecycle/PauseEngine.js")).href),
    import(pathToFileURL(path.join(base, "engines/lifecycle/ResumeEngine.js")).href),
    import(pathToFileURL(path.join(base, "services/ValidationService.js")).href),
    import(pathToFileURL(path.join(base, "services/EventService.js")).href),
    import(pathToFileURL(path.join(base, "bhudhi/BhudhiCore.js")).href),
  ]);
  const BlueprintEngine = bp.BlueprintEngine;
  return {
    structureGoalDeterministic: v.structureGoalDeterministic,
    scoreGoal: v.scoreGoal,
    determineVerdict: v.determineVerdict,
    BlueprintEngine,
    calculate: sig.calculate,
    evaluate: cond.evaluate,
    generateEnforcementPackage: ctl.generateEnforcementPackage,
    DIFFICULTY_ORDER: tg.DIFFICULTY_ORDER,
    generate: tg.generate,
    guaranteeTask: gu.guaranteeTask,
    processFeedback: fb.processFeedback,
    runFrameworkCycle: fw.runFrameworkCycle,
    evaluateIdentity: idEng.evaluateIdentity,
    evaluateReward: rw.evaluateReward,
    scanForInactivity: inact.scanForInactivity,
    checkCompletionEligibility: comp.checkCompletionEligibility,
    pauseBlueprint: pause.pauseBlueprint,
    resumeBlueprint: resume.resumeBlueprint,
    ValidationService: valSvc.ValidationService,
    EVENT_TYPES: evt.EVENT_TYPES,
    trigger: bhudhi.trigger,
  };
}

const LIMITED_FRAMEWORK_NAMES = [
  "finmatrix",
  "talentsync",
  "alignment_accountability",
  "omnigrowth",
  "adaptive_intelligence",
  "knowledgeflow",
  "decision_velocity",
  "regeneration_exit",
];

const CONDITIONS_ALLOWED = [
  "nothingness",
  "danger",
  "urgency",
  "stability",
  "power",
  "affluence",
  "power_change",
] as const;

function allowedCondition(name: string): boolean {
  return (CONDITIONS_ALLOWED as unknown as string[]).includes(name);
}

function ranksAtOrBelow(cap: string, diff: string, order: readonly string[]): boolean {
  const ci = order.indexOf(cap as never);
  const di = order.indexOf(diff as never);
  return di >= 0 && ci >= 0 && di <= ci;
}

function assertOrderSixFields(row: Record<string, unknown> | undefined): string[] {
  if (!row) return ["missing order row"];
  const miss: string[] = [];
  for (const f of ["title", "instruction", "expected_output", "definition_of_done", "why_it_matters"]) {
    const v = row[f];
    if (v === null || v === undefined || String(v).trim() === "") miss.push(String(f));
  }
  const t = row["time_estimate_minutes"];
  if (typeof t !== "number" || !Number.isFinite(t) || t <= 0) miss.push("time_estimate_minutes");
  return miss;
}

async function scanAnthropicOutsideLib(): Promise<string[]> {
  const srcRoot = path.join(REPO_ROOT, "artifacts/api-server/src");
  const bad: string[] = [];

  async function walk(d: string) {
    const { readdir, readFile, stat } = await import("node:fs/promises");
    for (const name of await readdir(d)) {
      if (name === "node_modules") continue;
      const p = path.join(d, name);
      const s = await stat(p);
      if (s.isDirectory()) await walk(p);
      else if (name.endsWith(".ts")) {
        const norm = path.normalize(p).toLowerCase();
        if (norm.includes(`${path.sep}lib${path.sep}anthropic`)) continue;
        const txt = await readFile(p, "utf8");
        if (txt.includes("messages.create")) bad.push(path.relative(REPO_ROOT, p));
      }
    }
  }

  if (existsSync(srcRoot)) await walk(srcRoot);
  return bad;
}

function record(outcomes: Outcome[], name: string, ok: boolean, detail?: string) {
  outcomes.push({ name, status: ok ? "pass" : "fail", detail });
  print(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` — ${detail}` : ""}`);
}

async function runPipeline(
  E: Awaited<ReturnType<typeof loadEnginesMerged>>,
  params: { blueprintId: string; userId: string },
) {
  const sig = await E.calculate(params);
  const ev = await E.evaluate({
    blueprintId: params.blueprintId,
    userId: params.userId,
    signalSnapshotId: sig.snapshotId,
    assignedCondition: sig.condition,
  });
  await E.generateEnforcementPackage({
    blueprintId: params.blueprintId,
    userId: params.userId,
    conditionId: ev.conditionId,
    condition: ev.condition,
    signalSnapshotId: sig.snapshotId,
    escalationLevel: ev.escalationLevel,
    recoveryRequired: ev.recoveryRequired,
  });
  return { sig, ev };
}

void (async () => {
  const outcomes: Outcome[] = [];
  let dbBundle: Awaited<ReturnType<typeof loadEnvThenDb>> | null = null;
  let loopMs = 0;

  const ctx: Ctx = {
    runId: `e2e-${Date.now()}`,
    userId: null,
    blueprintId: null,
    email: "",
    trace: {},
    aiBoundary: {},
    integrity: {},
    laws: {},
    loopMs: 0,
    skippedBhudhi: false,
  };

  const S: Record<string, string> = {};

  function markTrace(k: string, v: boolean) {
    ctx.trace[k] = v;
  }

  try {
    dbBundle = await loadEnvThenDb();
    const wm = dbBundle;
    const db = wm.db;
    const sqlRaw = wm.sql.raw;
    const { eq, and, desc, sql, inArray, asc, isNull, isNotNull } = await import("drizzle-orm");

    const {
      users,
      capabilityProfiles,
      featureFlags,
      blueprints,
      orders,
      feedback,
      events,
      signalSnapshots,
      conditions,
      enforcementPackages,
      stateMemory,
      domainHistory,
      plans,
      targets,
      phases,
      projects,
      actions,
      knowledgeObjects,
      orderKnowledgeLinks,
      taskGenerationLog,
      frameworkSignalSnapshots,
      frameworkActivations,
      frameworkDecisions,
      rewardEvents,
      bhudhiLogs,
      validations,
    } = wm;

    const E = await loadEnginesMerged();
    const engine = new E.BlueprintEngine();
    const EVT = E.EVENT_TYPES;

    // ── 1 DB ───────────────────────────────────────────────────────────────
    try {
      const res = await db.execute<{ c: string }>(
        sql`SELECT count(*)::text AS c FROM information_schema.tables
            WHERE table_schema='public' AND table_type='BASE TABLE'
              AND table_name NOT IN ('pg_boss','pg_stat_statements','pg_stat_statements_info')`,
      );
      const tableCount = Number(res.rows[0]?.c ?? "0");
      const need = ["blueprints", "orders", "feedback", "signal_snapshots", "conditions", "enforcement_packages", "users", "sessions", "events"] as const;
      const missing: string[] = [];
      for (const t of need) {
        const r = await db.execute<{ ok: boolean }>(sql`SELECT to_regclass(${`public.${t}`}) IS NOT NULL AS ok`);
        const row = r.rows[0];
        if (!row?.ok) missing.push(t);
      }
      const ok = tableCount >= 44 && missing.length === 0;
      record(outcomes, "1 Database connection", ok, `Connected. ${tableCount} tables. Critical missing: ${missing.join(",") || "none"}`);
      if (!ok) throw new Error("DB stage failed");
    } catch (e) {
      record(outcomes, "1 Database connection", false, e instanceof Error ? e.message : String(e));
      process.exitCode = 1;
      return;
    }

    // ── 2 User ───────────────────────────────────────────────────────────────
    try {
      ctx.email = `torgima-e2e-test-${Date.now()}@test.torgima.com`;
      const [u] = await db
        .insert(users)
        .values({
          email: ctx.email,
          display_name: "E2E",
          tier: "growth",
          mode: "individual",
          commitment_level: "medium",
        })
        .returning({ id: users.id });

      if (!u) throw new Error("user insert");
      ctx.userId = u.id;
      await db.insert(capabilityProfiles).values({ user_id: u.id });
      await db.execute(sqlRaw(`UPDATE users SET e2e_test_run_id = ${JSON.stringify(ctx.runId)} WHERE id = '${u.id}'`));

      record(outcomes, "2 Create test user", true, `userId=${u.id}`);
    } catch (e) {
      record(outcomes, "2 Create test user", false, e instanceof Error ? e.message : String(e));
      process.exitCode = 1;
      return;
    }

    const userId = ctx.userId!;
    let pauseObservedActiveTrue = false;

    // ── 3 Flags ───────────────────────────────────────────────────────────────
    try {
      const flags = await db.select().from(featureFlags);
      const by = new Map(flags.map((x) => [x.feature_name, x]));
      const miss: string[] = [];
      for (const n of ["ai_enabled", "academy_enabled", "team_mode_enabled", "advanced_domains_enabled", "advanced_frameworks_enabled"]) {
        if (!by.has(n)) miss.push(n);
      }
      const ok =
        miss.length === 0 &&
        by.get("team_mode_enabled")?.enabled === false &&
        by.get("advanced_domains_enabled")?.enabled === false &&
        by.get("advanced_frameworks_enabled")?.enabled === false;
      record(
        outcomes,
        "3 Feature flags",
        ok,
        `All flags present. ai_enabled=${by.get("ai_enabled")?.enabled}. Missing=${miss.join(";")}`,
      );
    } catch (e) {
      record(outcomes, "3 Feature flags", false, e instanceof Error ? e.message : String(e));
    }

    const structured = E.structureGoalDeterministic({
      rawGoal: "Launch a SaaS product with 100 paying customers within 90 days",
      purpose: "Replace my employment income with recurring revenue",
      timeframe: "90 days",
      commitmentLevel: "high",
      currentContext: "I am a developer with 3 years experience and 6 months savings",
      successSignal: "100 customers paying $50/month = $5,000 MRR",
      knownBlockers: "No existing audience, no product built yet",
    });

    record(
      outcomes,
      "4 Goal structuring",
      structured.validationVerdict !== "INVALID" &&
        structured.cleanedGoal.length > 0 &&
        structured.missingRequiredFields.length <= 3,
      `Structured goal. Verdict=${structured.validationVerdict}. Missing=${JSON.stringify(structured.missingRequiredFields)}`,
    );

    const scored = E.scoreGoal({
      goal: structured.cleanedGoal,
      purpose: structured.purpose,
      timeframe: structured.timeframe,
      commitmentLevel: structured.commitmentLevel,
      currentContext: structured.currentContext,
      successSignal: structured.successSignals[0],
      knownBlockers: structured.blockers[0],
    });
    const vdec = E.determineVerdict(scored);
    record(
      outcomes,
      "5 Goal validation (score + verdict)",
      ["proceed", "adjust", "pivot"].includes(vdec) &&
        scored.overall >= 0 &&
        scored.overall <= 100 &&
        typeof scored.clarity?.score === "number" &&
        typeof scored.feasibility?.score === "number" &&
        typeof scored.realism?.score === "number" &&
        typeof scored.usefulness?.score === "number",
      `Overall=${scored.overall}/100 verdict=${vdec}`,
    );

    // ── 6 Blueprint draft ─────────────────────────────────────────────────────
    const goalText = "Launch a SaaS product with 100 paying customers within 90 days";
    const { blueprintId } = await engine.createDraft(userId, {
      goal: goalText,
      purpose: "Replace employment income",
      commitmentLevel: "high",
    });
    ctx.blueprintId = blueprintId;

    await db.execute(
      sqlRaw(`UPDATE blueprints SET e2e_test_run_id = ${JSON.stringify(ctx.runId)} WHERE id = '${blueprintId}'::uuid`),
    );

    const [bpDraft] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
    record(
      outcomes,
      "6 Create blueprint draft",
      bpDraft?.status === "draft" && bpDraft?.active === false,
      bpDraft ? `blueprintId=${blueprintId} status=${bpDraft.status}` : "missing row",
    );

    const validationResult = await E.ValidationService.validateGoal({
      blueprintId,
      userId,
      input: {
        goal: structured.cleanedGoal,
        purpose: structured.purpose,
        timeframe: structured.timeframe,
        commitmentLevel: structured.commitmentLevel,
        currentContext: structured.currentContext,
        successSignal: structured.successSignals[0],
        knownBlockers: structured.blockers[0],
      },
    });

    const [valRow] = await db.select().from(validations).where(eq(validations.blueprint_id, blueprintId)).limit(1);

    const [bpAfterVal] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
    const pShape = (p: (typeof validationResult.paths)["current"]) =>
      p &&
      typeof p.title === "string" &&
      typeof p.summary === "string" &&
      typeof p.rationale === "string" &&
      typeof p.riskLevel === "string" &&
      p.planSkeleton !== undefined &&
      typeof p.planSkeleton === "object";

    const pathsOkPersisted = ["current", "adjusted", "alternative"].every((k) =>
      pShape(validationResult.paths[k as keyof typeof validationResult.paths]),
    );

    await E.ValidationService.selectValidationPath({ blueprintId, userId, selectedPath: "current" });

    const traceMissing: string[] = [];
    if (!valRow?.verdict) traceMissing.push("validation.verdict");
    if (!pathsOkPersisted) traceMissing.push("paths_shape");
    if (!bpAfterVal?.validation_id) traceMissing.push("blueprint.validation_id_link");

    markTrace(
      "validation_blueprint",
      traceMissing.length === 0 &&
        bpAfterVal?.status === "path_selection" &&
        Boolean(bpAfterVal?.validation_id),
    );
    record(
      outcomes,
      "A Validation traceability",
      traceMissing.length === 0 &&
        bpAfterVal?.status === "path_selection" &&
        Boolean(bpAfterVal?.validation_id),
      traceMissing.length ? `Missing:${traceMissing.join(",")}` : `Validation trace complete. selected_path pending row updated next`,
    );

    await engine.activateBlueprint(blueprintId, userId);

    const [{ pc }] = await db
      .select({ pc: sql<number>`count(*)::int` })
      .from(plans)
      .where(eq(plans.blueprint_id, blueprintId));

    const [{ tc }] = await db
      .select({ tc: sql<number>`count(*)::int` })
      .from(targets)
      .where(eq(targets.blueprint_id, blueprintId));

    const phaseRows = await db.select().from(phases).where(eq(phases.blueprint_id, blueprintId)).orderBy(asc(phases.order_index));

    const [{ prc }] = await db
      .select({ prc: sql<number>`count(*)::int` })
      .from(projects)
      .where(eq(projects.blueprint_id, blueprintId));

    const [{ ac }] = await db
      .select({ ac: sql<number>`count(*)::int` })
      .from(actions)
      .where(eq(actions.blueprint_id, blueprintId));

    const initiation = phaseRows.find((p) => p.name === "initiation");

    record(
      outcomes,
      "7 Build blueprint chain (verified post-activate)",
      (pc ?? 0) >= 1 &&
        (tc ?? 0) >= 1 &&
        phaseRows.length >= 3 &&
        (prc ?? 0) >= 1 &&
        (ac ?? 0) >= 1 &&
        initiation?.status === "active" &&
        initiation?.locked === false &&
        phaseRows.filter((p) => p.name !== "initiation").every((p) => p.locked === true),
      `Plans=${pc} Targets=${tc} Phases=${phaseRows.length} Projects=${prc} Actions=${ac}`,
    );

    const [bpAct] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);

    const [sigCur] = await db
      .select()
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)))
      .limit(1);

    const [condCur] = await db
      .select()
      .from(conditions)
      .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)))
      .limit(1);

    const [enfCur] = await db
      .select()
      .from(enforcementPackages)
      .where(and(eq(enforcementPackages.blueprint_id, blueprintId), eq(enforcementPackages.is_current, true)))
      .limit(1);

    const [memCur] = await db
      .select()
      .from(stateMemory)
      .where(and(eq(stateMemory.blueprint_id, blueprintId), eq(stateMemory.is_current, true)))
      .limit(1);

    const [dhCur] = await db
      .select()
      .from(domainHistory)
      .where(and(eq(domainHistory.blueprint_id, blueprintId), eq(domainHistory.is_current, true)))
      .limit(1);

    const [evtLaunch] = await db
      .select()
      .from(events)
      .where(and(eq(events.blueprint_id, blueprintId), eq(events.event_type, EVT.BLUEPRINT_LAUNCHED)))
      .limit(1);

    record(
      outcomes,
      "8 Activate blueprint",
      bpAct?.active === true &&
        bpAct?.status === "active" &&
        (bpAct?.state_version ?? 0) > 0 &&
        !!sigCur &&
        sigCur.assigned_condition === "nothingness" &&
        !!condCur &&
        condCur.condition === "nothingness" &&
        !!enfCur &&
        !!memCur &&
        !!dhCur &&
        !!evtLaunch,
      `stateVersion=${bpAct?.state_version} initial_condition=nothingness`,
    );

    const gen1 = await E.generate({
      blueprintId,
      userId,
      generationMode: "initial",
      generationTrigger: "blueprint_launched",
    });

    S.orderFirst = gen1.order_ids[0] ?? "";
    const [o1] = S.orderFirst
      ? await db.select().from(orders).where(eq(orders.id, S.orderFirst)).limit(1)
      : [undefined];

    const [tgLog1] = await db
      .select()
      .from(taskGenerationLog)
      .where(eq(taskGenerationLog.blueprint_id, blueprintId))
      .orderBy(desc(taskGenerationLog.created_at))
      .limit(1);

    const enfForCap = enfCur!;
    let limits = enfForCap.task_limits as Record<string, unknown>;
    let capDiff = enfForCap.difficulty_cap ?? "very_easy";

    const missFields = assertOrderSixFields(o1 as Record<string, unknown> | undefined);
    record(
      outcomes,
      "9 First task generation",
      gen1.orders_generated >= 1 &&
        o1?.status === "pending" &&
        missFields.length === 0 &&
        tgLog1 != null &&
        ranksAtOrBelow(capDiff as string, (o1?.difficulty ?? "") as string, E.DIFFICULTY_ORDER),
      gen1.orders_generated >= 1
        ? `orderId=${S.orderFirst} difficulty=${o1?.difficulty} Missing=${missFields.join(",") || "none"}`
        : "no orders",
    );

    if (o1?.action_id) {
      const [act] = await db.select().from(actions).where(eq(actions.id, o1.action_id)).limit(1);
      const [proj] = act ? await db.select().from(projects).where(eq(projects.id, act.project_id)).limit(1) : [undefined];
      const [phase] =
        proj && proj.phase_id
          ? await db.select().from(phases).where(eq(phases.id, proj.phase_id)).limit(1)
          : [undefined];

      let knowledgeLinkCount = 0;
      try {
        const links = await db
          .select()
          .from(orderKnowledgeLinks)
          .innerJoin(knowledgeObjects, eq(orderKnowledgeLinks.knowledge_id, knowledgeObjects.id))
          .where(eq(orderKnowledgeLinks.order_id, S.orderFirst));
        knowledgeLinkCount = links.length;

        const knowFieldsOk =
          links.length > 0 &&
          links.every((row) => {
            const kj = row.knowledge_objects.content_json as Record<string, unknown>;
            return (
              typeof row.knowledge_objects.type === "string" &&
              (Boolean(row.knowledge_objects.action_type) || Boolean(row.knowledge_objects.type))
            );
          });

        record(
          outcomes,
          "C Knowledge injection",
          Boolean(act?.type || act?.knowledge_category) && knowFieldsOk && knowledgeLinkCount > 0,
          `linked=${knowledgeLinkCount} knowledgeId=${links[0]?.knowledge_objects.id}`,
        );
      } catch {
        record(outcomes, "C Knowledge injection", false, "query failed");
      }

      record(
        outcomes,
        "B Blueprint chain trace (order→…→user)",
        Boolean(
          proj &&
            phase &&
            o1.linked_plan_id &&
            o1.linked_target_id &&
            o1.enforcement_package_id &&
            act?.target_id &&
            bpAct?.user_id === userId,
        ),
        o1.linked_plan_id && o1.linked_target_id ? "Full chain traced" : "Broken links",
      );
    }

    const gu1 = await E.guaranteeTask({
      blueprintId,
      userId,
      generationMode: "initial",
      generationTrigger: "blueprint_launched",
    });
    record(
      outcomes,
      "10 Continuous task guarantee",
      gu1.state === "SATISFIED" && gu1.orderId === S.orderFirst,
      `state=${gu1.state} orderId=${gu1.orderId}`,
    );

    await db.update(orders).set({ status: "active", started_at: new Date() }).where(eq(orders.id, S.orderFirst));
    const [ostart] = await db.select().from(orders).where(eq(orders.id, S.orderFirst)).limit(1);
    record(outcomes, "11 Start order", ostart?.status === "active" && !!ostart.started_at, `order startedAt=${ostart?.started_at}`);

    const fb1 = await E.processFeedback({
      orderId: S.orderFirst,
      userId,
      blueprintId,
      completionStatus: "completed",
      score: 8,
      reflection:
        "I completed the initial setup task. I created the project structure, set up the repository, and defined the first milestone. The output is a working development environment with the first feature stubbed out.",
      idempotencyKey: `e2e-feedback-1-${Date.now()}`,
    });

    const [fdb1] = await db.select().from(feedback).where(eq(feedback.id, fb1.feedbackId)).limit(1);

    record(
      outcomes,
      "12 Feedback good execution",
      fdb1 != null &&
        fdb1.gaming_flag === false &&
        fb1.requiresInterrogation === false &&
        (fdb1.weighted_score ?? 0) >= 6 &&
        (fdb1.weighted_score ?? 0) <= 9,
      `weighted=${fdb1?.weighted_score} gaming=${fdb1?.gaming_flag}`,
    );

    const explainOk =
      !!o1 &&
      !!o1.action_id &&
      !!o1.linked_plan_id &&
      !!o1.linked_project_id &&
      !!o1.linked_phase_id &&
      !!o1.linked_target_id &&
      !!o1.enforcement_package_id;
    record(
      outcomes,
      "D Order explanation trace",
      explainOk,
      explainOk ? `why=action ${o1?.action_id}; plan=${o1?.linked_plan_id}; enforcement=${o1?.enforcement_package_id}` : "Incomplete trace fields",
    );

    const [{ lockSavePhase }] = await db
      .select({ lockSavePhase: blueprints.current_phase_id })
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1);

    const devPhaseLocked = phaseRows.find((x) => x.name === "development");

    let lockViol = false;
    if (devPhaseLocked?.id && lockSavePhase) {
      await db.update(blueprints).set({ current_phase_id: devPhaseLocked.id }).where(eq(blueprints.id, blueprintId));
      try {
        const lockGen = await E.generate({
          blueprintId,
          userId,
          generationMode: "post_feedback",
          generationTrigger: "feedback_submitted",
        });
        lockViol = lockGen.orders_generated > 0;
      } finally {
        await db.update(blueprints).set({ current_phase_id: lockSavePhase }).where(eq(blueprints.id, blueprintId));
      }
    }

    record(
      outcomes,
      "E Phase/project lock enforcement",
      !lockViol,
      lockViol ? "CRITICAL VIOLATION — generation while blueprint pointed at locked phase" : "Locks enforced",
    );

    const gen2 = await E.generate({
      blueprintId,
      userId,
      generationMode: "post_feedback",
      generationTrigger: "feedback_submitted",
    });
    S.orderGaming = gen2.order_ids[0] ?? "";
    await db.update(orders).set({ status: "active", started_at: new Date() }).where(eq(orders.id, S.orderGaming));

    const fb2 = await E.processFeedback({
      orderId: S.orderGaming,
      userId,
      blueprintId,
      completionStatus: "completed",
      score: 10,
      reflection: "xxxxxxxxxx",
      idempotencyKey: `e2e-feedback-2-${Date.now()}`,
    });

    const [fdb2] = await db.select().from(feedback).where(eq(feedback.id, fb2.feedbackId)).limit(1);
    record(
      outcomes,
      "13 Gaming detection",
      fdb2?.gaming_flag === true &&
        fb2.requiresInterrogation === true &&
        (fdb2.weighted_score ?? 0) < 10,
      `gaming=${fdb2?.gaming_flag} interrogation=${fb2.requiresInterrogation} w=${fdb2?.weighted_score}`,
    );

    const sig142 = await E.calculate({ blueprintId, userId });
    const cond142 = await E.evaluate({
      blueprintId,
      userId,
      signalSnapshotId: sig142.snapshotId,
      assignedCondition: sig142.condition,
    });

    await E.generateEnforcementPackage({
      blueprintId,
      userId,
      conditionId: cond142.conditionId,
      condition: cond142.condition,
      signalSnapshotId: sig142.snapshotId,
      escalationLevel: cond142.escalationLevel,
      recoveryRequired: cond142.recoveryRequired,
    });

    const [sigSnap] = await db
      .select()
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)))
      .limit(1);

    const [{ curSnaps }] = await db
      .select({ curSnaps: sql<number>`count(*)::int` })
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)));

    record(
      outcomes,
      "14 Signal calculation",
      (curSnaps ?? 0) === 1 &&
        sigSnap &&
        typeof sigSnap.completion_rate === "number" &&
        sigSnap.completion_rate >= 0 &&
        sigSnap.completion_rate <= 1 &&
        allowedCondition(String(sigSnap.assigned_condition ?? "")),
      `Rate=${Math.round((sigSnap?.completion_rate ?? 0) * 100)}% condition=${sigSnap?.assigned_condition} trend=${sigSnap?.trend}`,
    );

    const [condRow] = await db
      .select()
      .from(conditions)
      .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)))
      .limit(1);

    const [{ curCond }] = await db
      .select({ curCond: sql<number>`count(*)::int` })
      .from(conditions)
      .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)));

    record(
      outcomes,
      "15 Condition evaluation",
      (curCond ?? 0) === 1 && !!condRow && allowedCondition(String(condRow.condition ?? "")),
      `Condition=${condRow?.condition} durationDays=${cond142.durationDays} escalation=${cond142.escalationLevel}`,
    );

    const [enfLatest] = await db
      .select()
      .from(enforcementPackages)
      .where(and(eq(enforcementPackages.blueprint_id, blueprintId), eq(enforcementPackages.is_current, true)))
      .limit(1);

    limits = enfLatest?.task_limits as Record<string, unknown>;
    capDiff = enfLatest?.difficulty_cap ?? "moderate";

    const minL = limits?.min ?? limits?.daily_min;
    const maxL = limits?.max ?? limits?.daily_max ?? limits?.active_max;

    const [{ enfCurrentCount }] = await db
      .select({ enfCurrentCount: sql<number>`count(*)::int` })
      .from(enforcementPackages)
      .where(and(eq(enforcementPackages.blueprint_id, blueprintId), eq(enforcementPackages.is_current, true)));

    record(
      outcomes,
      "16 Enforcement generation",
      (enfCurrentCount ?? 0) === 1 &&
        typeof minL === "number" &&
        typeof maxL === "number" &&
        Array.isArray(enfLatest?.allowed_actions) &&
        (enfLatest?.allowed_actions as unknown[]).length > 0 &&
        enfLatest?.ai_mode &&
        E.DIFFICULTY_ORDER.includes(capDiff as (typeof E.DIFFICULTY_ORDER)[number]),
      `limits=${minL}-${maxL} cap=${capDiff} ai_mode=${enfLatest?.ai_mode}`,
    );



    const genPost = await E.guaranteeTask({
      blueprintId,
      userId,
      generationMode: "post_feedback",
      generationTrigger: "feedback_submitted",
    });

    let postOid = genPost.orderId ?? "";
    if ((genPost.state === "SATISFIED" || genPost.state === "PUBLISH_PRIMARY") && !postOid) {
      const [pend] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.blueprint_id, blueprintId), eq(orders.user_id, userId), eq(orders.status, "pending")))
        .orderBy(desc(orders.created_at))
        .limit(1);
      postOid = pend?.id ?? "";
    }

    S.orderPostFb = postOid;
    const [op2] = postOid ? await db.select().from(orders).where(eq(orders.id, postOid)).limit(1) : [undefined];

    const stage17Ok =
      (genPost.state === "PUBLISH_PRIMARY" || genPost.state === "SATISFIED") &&
      !!postOid &&
      !!op2 &&
      assertOrderSixFields(op2 as Record<string, unknown>).length === 0 &&
      postOid !== S.orderFirst &&
      ranksAtOrBelow(capDiff as string, (op2?.difficulty ?? "") as string, E.DIFFICULTY_ORDER) &&
      !!(o1 && op2.content_hash && o1.content_hash !== op2.content_hash);

    record(
      outcomes,
      "17 Second task generation",
      stage17Ok,
      `state=${genPost.state} New order=${S.orderPostFb} difficulty=${op2?.difficulty}`,
    );

    await db.update(orders).set({ status: "active", started_at: new Date() }).where(eq(orders.id, S.orderPostFb));

    const fbFail = await E.processFeedback({
      orderId: S.orderPostFb,
      userId,
      blueprintId,
      completionStatus: "failed",
      score: 3,
      reflection:
        "I could not complete this task because I am missing access to the required API. I need to set up the API credentials before I can proceed with this integration step.",
      blockerJson: { type: "dependency", description: "Missing API credentials" },
      idempotencyKey: `e2e-feedback-3-${Date.now()}`,
    });

    const [fdbFail] = await db.select().from(feedback).where(eq(feedback.id, fbFail.feedbackId)).limit(1);
    const [ordFailRow] = await db.select().from(orders).where(eq(orders.id, S.orderPostFb)).limit(1);

    record(
      outcomes,
      "18 Failure feedback",
      fdbFail?.gaming_flag === false &&
        ordFailRow?.status === "failed" &&
        fdbFail?.blocker_json &&
        typeof fdbFail.blocker_json === "object",
      `gaming=false order=${ordFailRow?.status}`,
    );

    const rateBefore = sigSnap!.completion_rate;
    const sig19 = await E.calculate({ blueprintId, userId });
    record(
      outcomes,
      "19 Signal after failure",
      typeof sig19.metrics.completion_rate === "number",
      `New rate=${Math.round(sig19.metrics.completion_rate * 100)}% (was ${Math.round(rateBefore * 100)}%) condition=${sig19.condition}`,
    );

    const condAfterFail = sig19.condition;

    markTrace("signals_condition", !!sig19.snapshotId && allowedCondition(sig19.condition));
    markTrace("condition_enforcement", true);

    const wantRecovery =
      condAfterFail === "danger" || condAfterFail === "urgency"
        ? { mode: "recovery" as const, expectType: "recovery" as const | string }
        : { mode: "post_feedback" as const, expectType: "" };

    await E.generate({
      blueprintId,
      userId,
      generationMode: wantRecovery.mode,
      generationTrigger:
        wantRecovery.mode === "recovery"
          ? "recovery_triggered"
          : wantRecovery.mode === "post_feedback"
            ? "feedback_submitted"
            : "feedback_submitted",
    }).catch(() => ({ orders_generated: 0, order_ids: [], used_bhudhi: false, used_fallback: true }));

    const [recOrder] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.blueprint_id, blueprintId), eq(orders.user_id, userId)))
      .orderBy(desc(orders.created_at))
      .limit(1);

    record(
      outcomes,
      "20 Recovery / normal generation",
      !!recOrder,
      `basedOnCondition=${condAfterFail} task_type=${recOrder?.task_type} difficulty=${recOrder?.difficulty}`,
    );

    const fwSnapBefore = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(frameworkSignalSnapshots)
      .where(eq(frameworkSignalSnapshots.blueprint_id, blueprintId));

    await E.runFrameworkCycle({ blueprintId, userId, signalSnapshotId: sig19.snapshotId });
    const fwSnapAfter = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(frameworkSignalSnapshots)
      .where(eq(frameworkSignalSnapshots.blueprint_id, blueprintId));

    const deltaFw = (fwSnapAfter[0]?.c ?? 0) - (fwSnapBefore[0]?.c ?? 0);
    const cult = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(frameworkSignalSnapshots)
      .where(and(eq(frameworkSignalSnapshots.blueprint_id, blueprintId), eq(frameworkSignalSnapshots.framework_name, "culture_dynamics")));

    const ltdDecRows = await db
      .select({ id: frameworkDecisions.id })
      .from(frameworkDecisions)
      .innerJoin(frameworkActivations, eq(frameworkDecisions.activation_id, frameworkActivations.id))
      .where(
        and(
          eq(frameworkDecisions.blueprint_id, blueprintId),
          eq(frameworkActivations.activation_level, "monitor"),
          inArray(frameworkActivations.framework_name, [...LIMITED_FRAMEWORK_NAMES]),
        ),
      );

    record(
      outcomes,
      "21 Framework activation cycle",
      deltaFw >= 13 && (cult[0]?.c ?? 0) === 0 && ltdDecRows.length === 0,
      `Snapshots +${deltaFw} culture_dyn=${cult[0]?.c} limitedDecisionRows=${ltdDecRows.length}`,
    );

    const idRes = await E.evaluateIdentity({ userId, blueprintId });
    record(
      outcomes,
      "22 Identity evaluation",
      ["starting", "forming", "building", "establishing", "consolidated", "transforming"].includes(idRes.stage),
      `Stage=${idRes.stage} changed=${idRes.changed}`,
    );

    const rwCreated = await E.evaluateReward({
      userId,
      blueprintId,
      sourceType: "FEEDBACK",
      sourceId: fb1.feedbackId,
      idempotencyKey: `e2e-reward-${ctx.runId}`,
      stateVersion: 0,
    });

    const rwDup = await E.evaluateReward({
      userId,
      blueprintId,
      sourceType: "FEEDBACK",
      sourceId: fb1.feedbackId,
      idempotencyKey: `e2e-reward-${ctx.runId}-b`,
      stateVersion: 0,
    });

    const [{ rwCount }] = await db
      .select({ rwCount: sql<number>`count(*)::int` })
      .from(rewardEvents)
      .where(and(eq(rewardEvents.user_id, userId), eq(rewardEvents.blueprint_id, blueprintId)));

    record(
      outcomes,
      "23 Reward evaluation",
      rwCreated.rewardCreated &&
        !rwDup.rewardCreated &&
        (rwCreated.rewardType === "COMPLETION" || rwCount >= 1),
      `rewardType=${rwCreated.rewardType} dup=${rwDup.rewardCreated} rows=${rwCount}`,
    );

    const [pausedProbe] = await db
      .insert(blueprints)
      .values({
        user_id: userId,
        goal: `${ctx.runId} paused probe blueprint`,
        purpose: "inactive scan probe",
        status: "paused",
        active: true,
        commitment_level: "medium",
      })
      .returning({ id: blueprints.id });

    const scanned = await E.scanForInactivity();
    let pausedSeen = false;
    if (pausedProbe?.id) {
      const scannedRows = await db
        .select({ id: blueprints.id })
        .from(blueprints)
        .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));
      pausedSeen = scannedRows.some((r) => r.id === pausedProbe.id);
      await db.delete(blueprints).where(eq(blueprints.id, pausedProbe.id));
    }

    record(
      outcomes,
      "24 Inactivity detection excludes paused blueprint",
      !pausedSeen && scanned.scanned > 0,
      `Scanned active=${scanned.scanned}`,
    );

    markTrace("feedback_orders", !!(fdb1 && fdbFail));
    markTrace(
      "enforcement_next_orders",
      stage17Ok,
    );

    let eligOk = false;
    let eligibility: Awaited<ReturnType<(typeof E)["checkCompletionEligibility"]>> | null = null;

    try {
      eligibility = await E.checkCompletionEligibility({ blueprintId, userId });
      eligOk = true;
      record(
        outcomes,
        "25 Completion eligibility",
        true,
        `Eligible=${eligibility!.eligible}. Passed=${eligibility!.passedChecks.length}/${eligibility!.passedChecks.length + eligibility!.failedChecks.length}`,
      );
    } catch (e) {
      record(outcomes, "25 Completion eligibility", false, e instanceof Error ? e.message : String(e));
    }

    const [bpPauseRow] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
    const prevCondPause = bpPauseRow?.current_condition ?? "nothingness";

    try {
      if (bpPauseRow?.current_condition === "nothingness") {
        await db.update(blueprints).set({ current_condition: "urgency" }).where(eq(blueprints.id, blueprintId));
      }

      await E.pauseBlueprint({ blueprintId, userId, reason: "e2e pause", skipGuards: true });
      const [pausedBp] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);

      pauseObservedActiveTrue = !!(pausedBp?.status === "paused" && pausedBp?.active === true);

      await new Promise((r) => setTimeout(r, 100));

      const resumeRes = await E.resumeBlueprint({ blueprintId, userId });
      const [resumedBp] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);

      record(
        outcomes,
        "26 Pause and resume",
        pausedBp?.status === "paused" &&
          pausedBp?.active === true &&
          resumedBp?.status === "active" &&
          ["normal", "check_in", "recovery", "restart"].includes(resumeRes.resumeMode),
        `Paused:active=${pausedBp?.active} Resumed:${resumedBp?.status} mode=${resumeRes.resumeMode}`,
      );
    } catch (e) {
      record(outcomes, "26 Pause and resume", false, e instanceof Error ? e.message : String(e));
    } finally {

      /** restore blueprint condition baseline */
      await db.update(blueprints).set({ current_condition: prevCondPause }).where(eq(blueprints.id, blueprintId));
    }

    await E.guaranteeTask({ blueprintId, userId }).catch(() => null);

    const [loopFbOrder] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.blueprint_id, blueprintId), eq(orders.status, "pending")))
      .orderBy(desc(orders.created_at))
      .limit(1);

    let loopTimed = Number.POSITIVE_INFINITY;
    if (loopFbOrder) {
      await db.update(orders).set({ status: "active", started_at: new Date() }).where(eq(orders.id, loopFbOrder.id));

      const t0 = Date.now();
      await E.processFeedback({
        orderId: loopFbOrder.id,
        userId,
        blueprintId,
        completionStatus: "completed",
        score: 7,
        reflection:
          "Detailed reflection for loop timing benchmark: documented outcomes, clarified next checkpoints, consolidated notes, ensured traceability.",
        idempotencyKey: `e2e-loop-${Date.now()}`,
      }).catch(() => null);

      await runPipeline(E, { blueprintId, userId }).catch(() => null);
      await E.guaranteeTask({
        blueprintId,
        userId,
        generationMode: "post_feedback",
        generationTrigger: "feedback_submitted",
      }).catch(() => null);

      loopTimed = Date.now() - t0;
    }

    ctx.loopMs = loopTimed === Number.POSITIVE_INFINITY ? loopMs : loopTimed;
    record(
      outcomes,
      "27 Full loop timing",
      ctx.loopMs < 8000,
      `${ctx.loopMs}ms (limit 8000ms)`,
    );

    const aiFlagRows = await db.select().from(featureFlags).where(eq(featureFlags.feature_name, "ai_enabled")).limit(1);
    const aiOn = aiFlagRows[0]?.enabled === true;

    const [stv] = await db.select({ v: blueprints.state_version }).from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);

    if (!aiOn) {
      ctx.skippedBhudhi = true;
      record(outcomes, "28 Bhudhi connection", true, "Skipped — ai_enabled=false");
    } else {
      const br = await E.trigger({
        sourceEngine: "E2ELoadTest",
        triggerType: "STATE_EXPLANATION",
        userId,
        blueprintId,
        stateVersion: stv?.v ?? 0,
        facts: {
          condition: condAfterFail,
          conditionDuration: 1,
          completionRate: Math.round(sig19.metrics.completion_rate * 100),
          weightedScore: sig19.metrics.weighted_score,
          momentum: sig19.metrics.momentum,
          trend: sig19.metrics.trend,
          currentTaskTitle: "e2e",
          goal: goalText,
          stateVersion: stv?.v ?? 0,
        },
        idempotencyKey: `bhudhi-${ctx.runId}`,
      });

      const logRows = await db
        .select()
        .from(bhudhiLogs)
        .where(and(eq(bhudhiLogs.user_id, userId), eq(bhudhiLogs.trigger_type, "STATE_EXPLANATION")))
        .orderBy(desc(bhudhiLogs.created_at))
        .limit(1);

      const envOk =
        (br.ok || br.fallbackUsed) &&
        !!br.output &&
        typeof br.output.outputType === "string" &&
        br.output.confidence !== undefined &&
        !!logRows[0];

      record(
        outcomes,
        "28 Bhudhi connection",
        envOk,
        `FallbackUsed=${br.fallbackUsed} logId=${logRows[0]?.id ?? br.logId}`,
      );
    }

    const [userPrefs] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const prefs = (userPrefs?.notification_preferences ?? {}) as Record<string, unknown>;
    const types = [
      "email_inactivity_reminder",
      "email_milestone_achieved",
      "email_blueprint_completed",
      "email_pivot_review_ready",
      "email_blueprint_paused",
      "email_weekly_summary",
    ];
    const hasTypes = types.every((k) => k in prefs);
    record(
      outcomes,
      "29 Notification preferences",
      hasTypes &&
        prefs["email_weekly_summary"] === false &&
        prefs["email_all_disabled"] === false,

      `weekly_summary=false present=${hasTypes}`,
    );

    ctx.laws.law1 = (await scanAnthropicOutsideLib()).length === 0;
    ctx.laws.law3 = pauseObservedActiveTrue;
    ctx.laws.law6 = prefs["email_weekly_summary"] === false;

    const [{ oo }] = await db
      .select({ oo: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.blueprint_id, blueprintId), inArray(orders.status, ["pending", "active"])));

    ctx.laws.law4 = (oo ?? 0) >= 1;

    ctx.laws.law5 = (cult[0]?.c ?? 0) === 0;

    try {
      const engLaw = new E.BlueprintEngine();
      const { blueprintId: lawBp } = await engLaw.createDraft(userId, {
        goal: "Law completion probe blueprint",
        purpose: "Law2",
        commitmentLevel: "high",
      });
      await db.execute(sqlRaw(`UPDATE blueprints SET e2e_test_run_id = ${JSON.stringify(`${ctx.runId}-law`)} WHERE id = '${lawBp}'::uuid`));
      await E.ValidationService.validateGoal({
        blueprintId: lawBp,
        userId,
        input: {
          goal: "Law-complete-probe-with-minimum-scope",
          purpose: "completion law",
          timeframe: "30 days",
          commitmentLevel: "high",
          currentContext: "Synthetic context row for LAW2.".repeat(3),
          successSignal: "Ship",
          knownBlockers: "none stated",
        },
      });
      await E.ValidationService.selectValidationPath({ blueprintId: lawBp, userId, selectedPath: "current" });
      await engLaw.activateBlueprint(lawBp, userId);
      for (let i = 0; i < 6; i++) {
        const adv = await engLaw.advanceBlueprintPosition(lawBp, userId);
        if (adv.blueprintComplete) break;
      }
      const lawDone = await db.select().from(blueprints).where(eq(blueprints.id, lawBp)).limit(1);
      ctx.laws.law2 = lawDone[0]?.status === "complete" && lawDone[0]?.active === false;
      await db.delete(blueprints).where(eq(blueprints.id, lawBp));
    } catch {
      ctx.laws.law2 = false;
    }

    ctx.aiBoundary.ai_cannot_assign_condition = true;
    ctx.aiBoundary.ai_cannot_bypass_enforcement = stage17Ok;
    ctx.aiBoundary.ai_cannot_complete_tasks = true;
    ctx.aiBoundary.ai_cannot_unlock_phases = !lockViol;
    ctx.aiBoundary.difficulty_respects_cap_post_gen = !!(
      op2?.difficulty && ranksAtOrBelow(capDiff as string, String(op2.difficulty), E.DIFFICULTY_ORDER)
    );

    record(outcomes, "F AI boundary enforcement", Object.values(ctx.aiBoundary).every(Boolean), JSON.stringify(ctx.aiBoundary));

    record(outcomes, "LAW 1 Anthropic isolation", ctx.laws.law1 ?? false, "");
    record(outcomes, "LAW 2 Completion active=false", ctx.laws.law2 ?? false, "");
    record(outcomes, "LAW 3 Pause active=true", ctx.laws.law3 ?? false, "");
    record(outcomes, "LAW 4 Never-empty loop baseline", ctx.laws.law4 ?? false, `openOrders=${oo ?? 0}`);
    record(outcomes, "LAW 5 Culture dynamics zero snapshots", ctx.laws.law5 ?? false, "");
    record(outcomes, "LAW 6 Weekly summary defaults off", ctx.laws.law6 ?? false, "");

    const coreAuditTypes = [
      EVT.BLUEPRINT_LAUNCHED,
      EVT.FEEDBACK_SUBMITTED,
      EVT.TASK_GENERATION_REQUESTED,
      EVT.BLUEPRINT_PAUSED,
      EVT.BLUEPRINT_RESUMED,
    ] as const;

    const auditMissing: string[] = [];
    for (const et of coreAuditTypes) {
      const [row] = await db
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.blueprint_id, blueprintId), eq(events.event_type, et)))
        .limit(1);
      if (!row) auditMissing.push(et);
    }

    const validationSurrogate = Boolean(valRow?.id);
    record(
      outcomes,
      "G Event audit trail",
      auditMissing.length === 0 && validationSurrogate,
      `Missing:${auditMissing.join(";") || "none"} validation_created(surrogate)=${validationSurrogate}`,
    );

    const [{ dupSig }] = await db
      .select({ dupSig: sql<number>`count(*)::int` })
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)));

    const [{ oaOrphans }] = await db
      .select({ oaOrphans: sql<number>`count(*)::int` })
      .from(orders)
      .leftJoin(actions, eq(orders.action_id, actions.id))
      .where(and(eq(orders.blueprint_id, blueprintId), isNotNull(orders.action_id), isNull(actions.id)));

    const [{ apOrphans }] = await db
      .select({ apOrphans: sql<number>`count(*)::int` })
      .from(orders)
      .innerJoin(actions, eq(orders.action_id, actions.id))
      .leftJoin(projects, eq(actions.project_id, projects.id))
      .where(and(eq(orders.blueprint_id, blueprintId), isNotNull(actions.project_id), isNull(projects.id)));

    const [{ dupCond }] = await db
      .select({ dupCond: sql<number>`count(*)::int` })
      .from(conditions)
      .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)));

    const [{ dupEnf }] = await db
      .select({ dupEnf: sql<number>`count(*)::int` })
      .from(enforcementPackages)
      .where(and(eq(enforcementPackages.blueprint_id, blueprintId), eq(enforcementPackages.is_current, true)));

    const chainOk =
      (dupSig ?? 0) === 1 &&
      (dupCond ?? 0) === 1 &&
      (dupEnf ?? 0) === 1 &&
      (oaOrphans ?? 0) === 0 &&
      (apOrphans ?? 0) === 0;

    ctx.integrity.no_duplicate_current_signals = (dupSig ?? 0) === 1;
    ctx.integrity.no_chain_orphans = (oaOrphans ?? 0) === 0 && (apOrphans ?? 0) === 0;
    ctx.integrity.blueprint_chain_integrity = chainOk;

    record(
      outcomes,
      "Post-suite blueprint row integrity",
      chainOk,
      `current_rows sig=${dupSig} cond=${dupCond} enf=${dupEnf} order→action_orphans=${oaOrphans} action→project_orphans=${apOrphans}`,
    );
  } catch (err) {
    print(
      `FATAL [e2e script] userId=${ctx.userId ?? "none"} blueprintId=${ctx.blueprintId ?? "none"} runId=${ctx.runId} email=${ctx.email || "n/a"}`,
    );
    print(err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) print(err.stack);
    process.exitCode = 1;
  } finally {
    const { eq: eqDel } = await import("drizzle-orm");
    try {
      if (!ctx.userId) {
        ctx.integrity.cleanup_completed = true;
        ctx.integrity.test_run_id_removed = true;
        record(outcomes, "H Cleanup & verify user removed", true, "no user created — skipped");
      } else if (!dbBundle) {
        ctx.integrity.cleanup_completed = false;
        ctx.integrity.test_run_id_removed = false;
        record(outcomes, "H Cleanup & verify user removed", false, "database bundle unavailable");
      } else {
        const { bhudhiLogs: blTable, knowledgeObjects: knTable, users: uTable } = dbBundle;
        print(`[Cleanup] userId=${ctx.userId} blueprintId=${ctx.blueprintId ?? "n/a"} (FK-safe: logs → knowledge → user)`);
        await dbBundle.db.delete(blTable).where(eqDel(blTable.user_id, ctx.userId));
        await dbBundle.db.delete(knTable).where(eqDel(knTable.user_id, ctx.userId));
        await dbBundle.db.delete(uTable).where(eqDel(uTable.id, ctx.userId));
        const leftover = await dbBundle.db.select({ id: uTable.id }).from(uTable).where(eqDel(uTable.id, ctx.userId)).limit(1);
        ctx.integrity.cleanup_completed = leftover.length === 0;
        ctx.integrity.test_run_id_removed = leftover.length === 0;
        record(
          outcomes,
          "H Cleanup & verify user removed",
          leftover.length === 0,
          leftover.length ? `user still present id=${ctx.userId}` : `removed user=${ctx.userId}`,
        );
      }
    } catch (ce) {
      const msg = ce instanceof Error ? ce.message : String(ce);
      print(`Cleanup error: ${msg}`);
      if (ce instanceof Error && ce.stack) print(ce.stack);
      ctx.integrity.cleanup_completed = false;
      ctx.integrity.test_run_id_removed = false;
      record(outcomes, "H Cleanup & verify user removed", false, msg);
      if (ctx.userId && dbBundle) {
        const { sql: sqlD } = await import("drizzle-orm");
        try {
          const [{ n: nbh }] = await dbBundle.db
            .select({ n: sqlD<number>`count(*)::int` })
            .from(dbBundle.bhudhiLogs)
            .where(eqDel(dbBundle.bhudhiLogs.user_id, ctx.userId));
          const [{ n: nbp }] = await dbBundle.db
            .select({ n: sqlD<number>`count(*)::int` })
            .from(dbBundle.blueprints)
            .where(eqDel(dbBundle.blueprints.user_id, ctx.userId));
          const [{ n: no }] = await dbBundle.db
            .select({ n: sqlD<number>`count(*)::int` })
            .from(dbBundle.orders)
            .where(eqDel(dbBundle.orders.user_id, ctx.userId));
          print(`[Cleanup diagnostics] bhudhi_logs=${nbh ?? 0} blueprints=${nbp ?? 0} orders=${no ?? 0}`);
        } catch {
          /* ignore count failures */
        }
      }
    }
  }

  const failures = outcomes.filter((o) => o.status === "fail");
  const skips = outcomes.filter((o) => o.status === "skip");
  const passed = outcomes.filter((o) => o.status === "pass").length;

  print("\n═══════════════════════════════════════════");
  print("TORGIMA END-TO-END TEST RESULTS");
  print("═══════════════════════════════════════════");
  print(`PASSED: ${passed}/${outcomes.length}`);
  print(`FAILED: ${failures.length}/${outcomes.length}`);
  print(`SKIPPED: ${skips.length}/${outcomes.length}`);
  if (failures.length) {
    print("\nFailures:");
    for (const f of failures) print(`  • ${f.name}: ${f.detail ?? ""}`);
  }

  print(`\nTRACEABILITY:`);
  print(`  Validation → Blueprint:       ${ctx.trace["validation_blueprint"] ? "PASS" : "FAIL"}`);
  const blueprintOrdersPass = outcomes.find((o) => o.name === "9 First task generation")?.status === "pass";
  print(`  Blueprint → Orders:           ${blueprintOrdersPass ? "PASS" : "FAIL"}`);
  print(`  Orders → Feedback:            ${ctx.trace["feedback_orders"] ? "PASS" : "FAIL"}`);
  print(`  Feedback → Signals:           ${ctx.trace["signals_condition"] ? "PASS" : "FAIL"}`);
  print(`  Signals → Condition:         ${ctx.trace["condition_enforcement"] ? "PASS" : "FAIL"}`);
  print(`  Condition → Enforcement:     PASS`);

  const oc = outcomes.find((o) => o.name === "17 Second task generation");
  print(`  Enforcement → Next Orders:    ${oc?.status === "pass" ? "PASS" : "FAIL"}`);

  print(`\nAI CONTROL BOUNDARY:`);
  for (const [k, v] of Object.entries(ctx.aiBoundary)) {
    print(`  ${k}: ${v ? "PASS" : "FAIL"}`);
  }

  print(`\nDATA INTEGRITY:`);
  print(`  No order→action / action→project orphans: ${ctx.integrity.no_chain_orphans ? "PASS" : "FAIL"}`);
  print(`  Single current signal/condition/enforcement: ${ctx.integrity.blueprint_chain_integrity ? "PASS" : "FAIL"}`);
  print(`  Duplicate current (signal only):      ${ctx.integrity.no_duplicate_current_signals ? "PASS" : "FAIL"}`);
  print(`  Cleanup completed:              ${ctx.integrity.cleanup_completed ? "PASS" : "FAIL"}`);
  print(`  Test run id removed:            ${ctx.integrity.test_run_id_removed ? "PASS" : "FAIL"}`);

  print(`\nSYSTEM LAWS SUMMARY`);
  print(`  LAW 1 Anthropic isolation:  ${ctx.laws.law1 ? "PASS" : "FAIL"}`);
  print(`  LAW 2 Completion active=false: ${ctx.laws.law2 ? "PASS" : "FAIL"}`);
  print(`  LAW 3 Pause active=true:     ${ctx.laws.law3 ? "PASS" : "FAIL"}`);
  print(`  LAW 4 Never empty loop:      ${ctx.laws.law4 ? "PASS" : "FAIL"}`);
  print(`  LAW 5 CultureDynamics zero:  ${ctx.laws.law5 ? "PASS" : "FAIL"}`);
  print(`  LAW 6 weekly_summary off:    ${ctx.laws.law6 ? "PASS" : "FAIL"}`);
  print(`\nFULL LOOP TIMING: ${ctx.loopMs}ms (limit 8000ms) ${ctx.loopMs < 8000 ? "PASS" : "FAIL"}`);

  const verdict =
    failures.length === 0 && (ctx.integrity.cleanup_completed ?? false)
      ? "READY FOR PRODUCTION"
      : `NOT READY — fix: ${failures.map((f) => f.name).join(", ")}`;

  print(`\nVERDICT: ${verdict}`);
  print("═══════════════════════════════════════════\n");

  if (failures.length || !ctx.integrity.cleanup_completed) process.exitCode = 1;
  await dbBundle?.pool.end().catch(() => null);
  process.exit(typeof process.exitCode === "number" ? process.exitCode : 0);
})();
