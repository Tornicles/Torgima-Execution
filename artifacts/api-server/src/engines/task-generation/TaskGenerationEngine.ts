import crypto from "crypto";
import {
  db,
  blueprints,
  enforcementPackages,
  capabilityProfiles,
  projects,
  actions,
  targets,
  phases,
  plans,
  orders,
  knowledgeObjects,
  orderKnowledgeLinks,
  taskGenerationLog,
  featureFlags,
} from "@workspace/db";
import { eq, and, or, desc, gte, inArray, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { TorgimaError } from "../../lib/errors.js";
import { trigger } from "../../bhudhi/BhudhiCore.js";

export const DIFFICULTY_ORDER = [
  "very_easy",
  "easy",
  "moderate",
  "hard",
  "very_hard",
] as const;

type OrderDifficulty = (typeof orders.$inferSelect)["difficulty"];

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface GenerationResult {
  orders_generated: number;
  order_ids: string[];
  used_bhudhi: boolean;
  used_fallback: boolean;
}

// ── CONTEXT LOADING ───────────────────────────────────────────────────────────

async function loadContext(params: {
  blueprintId: string;
  userId: string;
  generationMode: string;
  generationTrigger: string;
  enforcementPackageId?: string;
}) {
  const { blueprintId, userId } = params;

  const [blueprint] = await db
    .select()
    .from(blueprints)
    .where(
      and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId), eq(blueprints.active, true)),
    )
    .limit(1);

  if (!blueprint) throw new TorgimaError("NOT_FOUND", "Active blueprint not found", false);

  const pkgCond = params.enforcementPackageId
    ? eq(enforcementPackages.id, params.enforcementPackageId)
    : and(eq(enforcementPackages.blueprint_id, blueprintId), eq(enforcementPackages.is_current, true));

  const [pkg] = await db.select().from(enforcementPackages).where(pkgCond).limit(1);

  if (!pkg) throw new TorgimaError("NOT_FOUND", "No active enforcement package", false);

  const [capability] = await db
    .select()
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.user_id, userId))
    .limit(1);

  const [currentProject] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.blueprint_id, blueprintId), inArray(projects.status, ["pending", "active"])),
    )
    .orderBy(projects.order_index)
    .limit(1);

  const nextAction = currentProject
    ? await db
        .select()
        .from(actions)
        .where(and(eq(actions.project_id, currentProject.id), eq(actions.status, "pending")))
        .orderBy(actions.order_index)
        .limit(1)
        .then((r) => r[0] ?? null)
    : null;

  let currentPhase: typeof phases.$inferSelect | null = null;
  if (blueprint.current_phase_id) {
    const [ph] = await db
      .select()
      .from(phases)
      .where(eq(phases.id, blueprint.current_phase_id))
      .limit(1);
    currentPhase = ph ?? null;
  }

  let currentPlan: typeof plans.$inferSelect | null = null;
  if (blueprint.current_plan_id) {
    const [pl] = await db.select().from(plans).where(eq(plans.id, blueprint.current_plan_id)).limit(1);
    currentPlan = pl ?? null;
  }

  const currentTarget =
    currentPhase
      ? await db
          .select()
          .from(targets)
          .where(and(eq(targets.blueprint_id, blueprintId), inArray(targets.status, ["active", "pending"])))
          .orderBy(targets.order_index)
          .limit(1)
          .then((r) => r[0] ?? null)
      : null;

  const domainHint = blueprint.current_domain ?? "genesis";

  const knowledgeRows = await db
    .select()
    .from(knowledgeObjects)
    .where(
      and(
        eq(knowledgeObjects.active, true),
        or(
          eq(knowledgeObjects.is_global, true),
          eq(knowledgeObjects.blueprint_id, blueprintId),
          eq(knowledgeObjects.domain, domainHint),
        ),
      ),
    )
    .limit(5);

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const recentOrders = await db
    .select({ content_hash: orders.content_hash })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, blueprintId),
        eq(orders.user_id, userId),
        gte(orders.created_at, sevenDaysAgo),
      ),
    )
    .orderBy(desc(orders.created_at))
    .limit(20);

  const taskLimits = (pkg.task_limits as { min?: number; max?: number }) ?? { min: 1, max: 3 };
  const overrideFlags = (pkg.override_flags as Record<string, unknown>) ?? {};

  return {
    blueprint: {
      id: blueprint.id,
      goal: blueprint.goal,
      purpose: blueprint.purpose ?? undefined,
      current_domain: blueprint.current_domain ?? undefined,
      current_condition: blueprint.current_condition ?? undefined,
    },
    plan: currentPlan,
    phase: currentPhase,
    project: currentProject,
    action: nextAction,
    target: currentTarget,
    enforcement: {
      task_limits: { min: taskLimits.min ?? 1, max: taskLimits.max ?? 3 },
      difficulty_cap: pkg.difficulty_cap as string,
      allowed_actions: pkg.allowed_actions ?? [],
      blocked_actions: pkg.blocked_actions ?? [],
      ai_mode: (pkg.ai_mode as string) ?? "command",
      recovery_required: Boolean(overrideFlags["recovery_required"]),
      feature_permissions: (pkg.feature_permissions as Record<string, boolean>) ?? {},
      condition_code: pkg.condition as string,
    },
    capability: {
      level: (capability?.level as string) ?? "beginner",
      consistency: capability?.consistency_score ?? 0,
      execution_quality: capability?.execution_quality ?? 0,
      current_streak: capability?.streak_current ?? 0,
    },
    knowledge_objects: knowledgeRows,
    recent_task_hashes: recentOrders.map((o) => o.content_hash).filter(Boolean) as string[],
    enforcement_package_id: pkg.id,
    generation_mode: params.generationMode,
    generation_trigger: params.generationTrigger,
  };
}

// ── ENUM NORMALIZATION (Postgres enums) ────────────────────────────────────────

function normalizeGenerationMode(raw: string): (typeof taskGenerationLog.$inferInsert)["generation_mode"] {
  const allowed = ["initial", "post_feedback", "daily", "recovery", "condition_change"] as const;
  const r = raw.toLowerCase();
  if ((allowed as readonly string[]).includes(r)) return r as (typeof allowed)[number];
  return "post_feedback";
}

function normalizeGenerationTrigger(raw: string): (typeof taskGenerationLog.$inferInsert)["generation_trigger"] {
  const allowed = [
    "blueprint_launched",
    "feedback_submitted",
    "condition_changed",
    "task_completed",
    "task_blocked",
    "user_inactive",
    "phase_checkpoint_required",
    "academy_gap_detected",
    "weekly_review_due",
    "habit_check_due",
    "dependency_unblocked",
    "daily_cycle",
    "recovery_triggered",
    "manual_regeneration",
  ] as const;
  const map: Record<string, (typeof allowed)[number]> = {
    task_generation_requested: "manual_regeneration",
    guarantee_check: "daily_cycle",
    guarantee_fallback: "recovery_triggered",
    enforcement_package_created: "feedback_submitted",
    inactivity_detected: "user_inactive",
    blueprint_resumed: "daily_cycle",
    resume: "daily_cycle",
    pivot_continue: "manual_regeneration",
    pivot_adjust: "recovery_triggered",
    pivot_full: "recovery_triggered",
    pivot_dismissed: "manual_regeneration",
  };
  const resolved = map[raw] ?? (raw as (typeof allowed)[number]);
  if ((allowed as readonly string[]).includes(resolved)) return resolved;
  return "manual_regeneration";
}

// ── TASK TYPE SELECTION ───────────────────────────────────────────────────────

function selectTaskType(ctx: Awaited<ReturnType<typeof loadContext>>): string {
  const { enforcement, phase, action, generation_mode } = ctx;

  if (generation_mode === "recovery" || enforcement.recovery_required) return "recovery";

  if (phase?.status === "gated") return "phase_checkpoint";

  if (!action && !ctx.project) return "clarification";

  return "execution";
}

// ── DIFFICULTY SELECTION ──────────────────────────────────────────────────────

function selectDifficulty(params: {
  difficulty_cap: string;
  capability_level: string;
  action_type?: string | null;
  generation_mode: string;
  current_streak: number;
  is_first_in_phase: boolean;
}): string {
  const order = DIFFICULTY_ORDER as readonly string[];
  const capIdx = order.indexOf(params.difficulty_cap);
  const safeCap = capIdx >= 0 ? capIdx : order.indexOf("moderate");

  // Recovery tasks stay deliberately lightweight (verification: difficulty very_easy).
  if (params.generation_mode === "recovery") {
    return "very_easy";
  }

  if (params.generation_mode === "initial") {
    return DIFFICULTY_ORDER[Math.min(1, safeCap)] ?? "easy";
  }

  if (params.is_first_in_phase) {
    return DIFFICULTY_ORDER[Math.max(0, safeCap - 1)] ?? "easy";
  }

  const hardActionTypes = ["analyze", "improve", "standardize", "build", "publish", "validate"];
  if (params.action_type && hardActionTypes.includes(params.action_type)) {
    return params.difficulty_cap;
  }

  if (params.current_streak >= 7) return params.difficulty_cap;

  return DIFFICULTY_ORDER[Math.max(0, safeCap - 1)] ?? "moderate";
}

// ── VALUE SCORE ───────────────────────────────────────────────────────────────

function calculateValueScore(params: {
  action_type?: string | null;
  task_type: string;
  difficulty: string;
  is_critical: boolean;
}): number {
  let score = 5.0;
  const action_scores: Record<string, number> = {
    create: 1.0,
    replicate: 0.8,
    analyze: 1.5,
    improve: 1.5,
    standardize: 1.8,
    recover: 0.5,
    test: 1.2,
    publish: 1.8,
    validate: 1.2,
    measure: 1.3,
    build: 1.8,
  };
  score += action_scores[params.action_type ?? ""] ?? 1.0;
  if (params.is_critical) score += 1.5;
  const diff_scores: Record<string, number> = {
    very_easy: 0.0,
    easy: 0.2,
    moderate: 0.4,
    hard: 0.7,
    very_hard: 1.0,
  };
  score += diff_scores[params.difficulty] ?? 0.4;
  return Math.min(score, 10.0);
}

type BuiltContent = {
  title: string;
  instruction: string;
  expected_output: string;
  definition_of_done: string;
  why_it_matters: string;
  time_estimate_minutes: number;
  proof_required: boolean;
  proof_type?: string;
  proof_description?: string;
};

function buildTaskContent(params: {
  task_type: string;
  goal: string;
  action?: { name: string; type: string } | null;
  target?: { name: string } | null;
  phase?: { name: string } | null;
  project?: { name: string } | null;
  difficulty: string;
}): BuiltContent {
  const { task_type, goal, action, target, phase, project, difficulty } = params;
  const context = action?.name ?? target?.name ?? project?.name ?? "your goal";

  const templates: Record<string, () => BuiltContent> = {
    execution: () => ({
      title: `${actionVerb(action?.type ?? "create")}: ${truncate(context, 60)}`,
      instruction: `Execute the next step for: ${context}.\n\nYour goal is: "${truncate(goal, 200)}"\n\nComplete the specific deliverable for this action. Be concrete about what you will do, how long it will take, and what output you will produce.`,
      expected_output: `A completed deliverable for: ${context}. Something concrete that can be reviewed.`,
      definition_of_done: `The action "${context}" has a visible, reviewable output. You can describe exactly what changed as a result of this work.`,
      why_it_matters: `This advances your blueprint toward: "${truncate(goal, 100)}"`,
      time_estimate_minutes: difficultyTime(difficulty),
      proof_required: ["hard", "very_hard"].includes(difficulty),
      proof_type: ["hard", "very_hard"].includes(difficulty) ? "text" : undefined,
      proof_description: ["hard", "very_hard"].includes(difficulty)
        ? "Describe the output you produced."
        : undefined,
    }),

    recovery: () => ({
      title: "Restart Your Execution",
      instruction:
        'Do not try to catch up. Start from right now. Choose ONE small concrete action toward your goal and complete it fully. Then submit feedback.\n\nYour goal: "' +
        truncate(goal, 150) +
        '"',
      expected_output: "One task fully completed with honest feedback submitted.",
      definition_of_done:
        "You completed a single concrete action and submitted feedback describing what you actually did.",
      why_it_matters:
        "Consistent return beats catching up. One completion today is worth more than five planned.",
      time_estimate_minutes: 20,
      proof_required: false,
    }),

    clarification: () => ({
      title: "Clarify Your Next Direction",
      instruction: `Your goal: "${truncate(goal, 200)}"\n\nWrite the next concrete action you should take. Be specific:\n- What will you do?\n- How long will it take?\n- How will you know it is done?`,
      expected_output: "A written next-action plan with specific details.",
      definition_of_done: "The plan contains: action, time estimate, and completion criteria.",
      why_it_matters: "Without clarity on the next step, all effort scatters.",
      time_estimate_minutes: 15,
      proof_required: false,
    }),

    blocker_resolution: () => ({
      title: "Resolve Your Blocker",
      instruction:
        "Name the exact thing blocking you. Classify it:\n- Skill gap → define what you need to learn\n- Resource gap → find minimum viable resource\n- Dependency → define what you are waiting for\n- Decision → make the decision now\n\nTake at least one concrete resolution action.",
      expected_output: "Blocker named, classified, and at least one resolution action taken.",
      definition_of_done:
        "Blocker is named in writing and one action has been taken or a help request made.",
      why_it_matters:
        "Unresolved blockers compound. Naming them precisely is the first step to removing them.",
      time_estimate_minutes: 20,
      proof_required: false,
    }),

    phase_checkpoint: () => ({
      title: `Phase Checkpoint: ${phase?.name ?? "Current Phase"}`,
      instruction:
        "You have reached a phase gate. Complete this checkpoint:\n1. List the outcomes you achieved in this phase\n2. Provide evidence for each outcome\n3. Name what blocked you\n4. State risks for the next phase",
      expected_output: "Completed phase checkpoint with all four sections filled.",
      definition_of_done:
        "All four sections completed and submitted. Evidence provided for each outcome claim.",
      why_it_matters: "Phase advancement requires verified completion, not assumed completion.",
      time_estimate_minutes: 30,
      proof_required: true,
      proof_type: "text",
      proof_description: "Provide evidence for each outcome listed.",
    }),

    review: () => ({
      title: "Weekly Execution Review",
      instruction:
        "Complete your weekly review:\n1. What did you complete this week?\n2. What did you fail to complete? Why?\n3. What is the single most important thing to focus on next week?\n4. What one thing would make next week better?",
      expected_output: "Written answers to all four review questions.",
      definition_of_done: "All four questions answered with specific, actionable responses.",
      why_it_matters: "Weekly review converts execution data into improvement.",
      time_estimate_minutes: 25,
      proof_required: false,
    }),

    academy: () => ({
      title: "Learn: " + truncate(context, 60),
      instruction: `Study the concept or skill needed for: ${context}.\n\nAfter studying:\n1. Write a 2-3 sentence summary of what you learned\n2. Describe how you will apply it\n3. Identify one practice exercise you can complete today`,
      expected_output: "Written learning summary and application plan.",
      definition_of_done: "Summary written and one practice step identified and ready to execute.",
      why_it_matters: "Capability gaps block execution. Learning fills the gap.",
      time_estimate_minutes: 30,
      proof_required: false,
    }),

    habit: () => ({
      title: "Habit Check-In",
      instruction:
        "Complete your daily habit check-in. For each active habit: mark whether you completed it, rate your effort (1-5), and note what helped or hindered you.",
      expected_output: "Completed habit check-in with effort ratings.",
      definition_of_done: "All active habits reviewed and marked.",
      why_it_matters: "Habits build the consistent behavior patterns that execution requires.",
      time_estimate_minutes: 10,
      proof_required: false,
    }),
  };

  const template = templates[task_type] ?? templates.execution;
  return template();
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 3) + "...";
}

function actionVerb(actionType: string): string {
  const verbs: Record<string, string> = {
    create: "Create",
    build: "Build",
    analyze: "Analyze",
    improve: "Improve",
    test: "Test",
    validate: "Validate",
    publish: "Publish",
    measure: "Measure",
    recover: "Recover",
    standardize: "Standardize",
    replicate: "Replicate",
  };
  return verbs[actionType] ?? "Execute";
}

function difficultyTime(difficulty: string): number {
  const times: Record<string, number> = {
    very_easy: 15,
    easy: 25,
    moderate: 45,
    hard: 90,
    very_hard: 120,
  };
  return times[difficulty] ?? 45;
}

// ── BHUDHI ENRICHMENT ─────────────────────────────────────────────────────────

async function enrichWithBhudhi(
  content: BuiltContent,
  ctx: Awaited<ReturnType<typeof loadContext>>,
  userId: string,
): Promise<BuiltContent | null> {
  const [bp] = await db
    .select({ state_version: blueprints.state_version })
    .from(blueprints)
    .where(eq(blueprints.id, ctx.blueprint.id))
    .limit(1);

  const result = await trigger({
    sourceEngine:   "TaskGenerationEngine",
    triggerType:    "TASK_DRAFTING",
    userId,
    blueprintId:    ctx.blueprint.id,
    stateVersion:   bp?.state_version ?? 0,
    idempotencyKey: `task_draft:${ctx.blueprint.id}:${Date.now()}`,
    facts: {
      goal:           ctx.blueprint.goal,
      domain:         ctx.blueprint.current_domain ?? "delivery",
      taskType:       ctx.generation_mode,
      actionContext:  ctx.action?.name ?? ctx.target?.name ?? "next step",
      difficulty:     content.time_estimate_minutes > 60 ? "hard" : "moderate",
      proofType:      content.proof_type ?? "none",
      condition:      "urgency",
      allowedActions: ctx.enforcement.allowed_actions,
    },
  });

  if (!result.ok || !result.output) return null;
  const d = result.output.data as Record<string, unknown>;
  if (!d["title"] || !d["instruction"]) return null;

  return {
    ...content,
    title:            String(d["title"]),
    instruction:      String(d["instruction"]),
    why_it_matters:   String(d["userFacingReason"] ?? content.why_it_matters),
    proof_description: d["proofInstruction"]
      ? String(d["proofInstruction"])
      : content.proof_description,
  };
}

function buildContentHash(title: string, instruction: string): string {
  return crypto.createHash("sha256").update(`${title}:${instruction}`).digest("hex").slice(0, 16);
}

async function insertGenerationLog(params: {
  blueprintId: string;
  userId: string;
  generationTrigger: string;
  generationMode: string;
  conditionAtGeneration: string;
  enforcementPackageId: string;
  capabilityLevel: string;
  domainAtGeneration: string;
  inputJson: Record<string, unknown>;
  orderIds: string[];
  ordersGenerated: number;
  usedFallback: boolean;
  aiUsed: boolean;
}): Promise<void> {
  await db
    .insert(taskGenerationLog)
    .values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      generation_trigger: normalizeGenerationTrigger(params.generationTrigger),
      generation_mode: normalizeGenerationMode(params.generationMode),
      condition_at_generation: params.conditionAtGeneration,
      enforcement_package_id: params.enforcementPackageId,
      capability_level: params.capabilityLevel,
      domain_at_generation: params.domainAtGeneration,
      input_json: params.inputJson,
      orders_generated: params.ordersGenerated,
      order_ids: params.orderIds,
      used_fallback: params.usedFallback,
      ai_used: params.aiUsed,
    })
    .catch(() => null);
}

// ── MAIN GENERATION ───────────────────────────────────────────────────────────

export async function generate(params: {
  blueprintId: string;
  userId: string;
  generationMode: string;
  generationTrigger: string;
  enforcementPackageId?: string;
  causationEventId?: string;
}): Promise<GenerationResult> {
  const genModeNorm = normalizeGenerationMode(params.generationMode);
  const genTrigNorm = normalizeGenerationTrigger(params.generationTrigger);

  const ctx = await loadContext({
    ...params,
    generationMode: genModeNorm,
    generationTrigger: genTrigNorm,
  });

  const { enforcement } = ctx;

  if (params.generationMode === "condition_change" || genModeNorm === "condition_change") {
    const capIdx = (DIFFICULTY_ORDER as readonly string[]).indexOf(enforcement.difficulty_cap);
    const invalidDifficulties = DIFFICULTY_ORDER.slice(capIdx + 1) as OrderDifficulty[];
    if (invalidDifficulties.length > 0) {
      await db
        .update(orders)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(orders.blueprint_id, params.blueprintId),
            eq(orders.user_id, params.userId),
            eq(orders.status, "pending"),
            inArray(orders.difficulty, invalidDifficulties),
          ),
        );
    }
  }

  const [{ existingCount } = { existingCount: 0 }] = await db
    .select({ existingCount: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, params.blueprintId),
        eq(orders.user_id, params.userId),
        inArray(orders.status, ["pending", "active"]),
      ),
    );

  const countActive = existingCount ?? 0;

  if (countActive >= enforcement.task_limits.max) {
    logger.info(
      { blueprintId: params.blueprintId, existingCount: countActive },
      "[TaskEngine] Already at max tasks — skipping",
    );
    await insertGenerationLog({
      blueprintId: params.blueprintId,
      userId: params.userId,
      generationTrigger: params.generationTrigger,
      generationMode: params.generationMode,
      conditionAtGeneration: enforcement.condition_code,
      enforcementPackageId: ctx.enforcement_package_id,
      capabilityLevel: ctx.capability.level,
      domainAtGeneration: ctx.blueprint.current_domain ?? "delivery",
      inputJson: { skipped: "at_task_cap", existingCount: countActive },
      orderIds: [],
      ordersGenerated: 0,
      usedFallback: false,
      aiUsed: false,
    });
    return { orders_generated: 0, order_ids: [], used_bhudhi: false, used_fallback: false };
  }

  let taskType = selectTaskType(ctx);
  const isFirstInPhase =
    ctx.phase?.status === "active" && countActive === 0;
  let difficulty = selectDifficulty({
    difficulty_cap: enforcement.difficulty_cap,
    capability_level: ctx.capability.level,
    action_type: ctx.action?.type ?? undefined,
    generation_mode: genModeNorm,
    current_streak: ctx.capability.current_streak,
    is_first_in_phase: isFirstInPhase,
  });

  let content = buildTaskContent({
    task_type: taskType,
    goal: ctx.blueprint.goal,
    action: ctx.action ? { name: ctx.action.name, type: ctx.action.type } : null,
    target: ctx.target ? { name: ctx.target.name } : null,
    phase: ctx.phase ? { name: ctx.phase.name } : null,
    project: ctx.project ? { name: ctx.project.name } : null,
    difficulty,
  });

  let usedBhudhi = false;
  let usedFallback = false;

  const [aiFlag] = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(eq(featureFlags.feature_name, "ai_enabled"))
    .limit(1);

  if (
    aiFlag?.enabled &&
    taskType === "execution"
  ) {
    try {
      const enriched = await Promise.race([
        enrichWithBhudhi(content, ctx, params.userId),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
      ]);
      if (enriched) {
        content = enriched;
        usedBhudhi = true;
      }
    } catch {
      usedFallback = true;
    }
  }

  let hash = buildContentHash(content.title, content.instruction);
  if (ctx.recent_task_hashes.includes(hash)) {
    logger.info({ blueprintId: params.blueprintId, hash }, "[TaskEngine] Duplicate hash — clarification fallback");
    usedFallback = true;
    taskType = "clarification";
    difficulty = "easy";
    content = buildTaskContent({
      task_type: "clarification",
      goal: ctx.blueprint.goal,
      action: null,
      target: ctx.target ? { name: ctx.target.name } : null,
      phase: ctx.phase ? { name: ctx.phase.name } : null,
      project: null,
      difficulty,
    });
    content.instruction += `\n\n(unique ref: ${Date.now()})`;
    hash = buildContentHash(content.title, content.instruction);
  }

  const valueScore = calculateValueScore({
    action_type: ctx.action?.type,
    task_type: taskType,
    difficulty,
    is_critical: ctx.phase?.status === "gated",
  });

  const domainGen = ctx.blueprint.current_domain ?? "delivery";

  const orderId = await db.transaction(async (tx: Tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        blueprint_id: params.blueprintId,
        user_id: params.userId,
        action_id: ctx.action?.id,
        linked_plan_id: ctx.plan?.id,
        linked_target_id: ctx.target?.id,
        linked_phase_id: ctx.phase?.id,
        linked_project_id: ctx.project?.id,
        enforcement_package_id: ctx.enforcement_package_id,
        task_type: taskType as typeof orders.$inferInsert["task_type"],
        title: content.title,
        instruction: content.instruction,
        expected_output: content.expected_output,
        definition_of_done: content.definition_of_done,
        why_it_matters: content.why_it_matters,
        time_estimate_minutes: content.time_estimate_minutes,
        proof_required: content.proof_required,
        proof_type: content.proof_type as typeof orders.$inferInsert["proof_type"],
        proof_description: content.proof_description,
        difficulty: difficulty as typeof orders.$inferInsert["difficulty"],
        priority: Math.round(valueScore),
        domain: domainGen as typeof orders.$inferInsert["domain"],
        value_score: valueScore,
        content_hash: hash,
        condition_at_generation: enforcement.condition_code,
        domain_at_generation: domainGen,
        generation_reason: `${params.generationTrigger} — ${params.generationMode} — ${taskType}`,
        status: "pending",
      })
      .returning({ id: orders.id });

    if (!order) throw new Error("Failed to create order");

    const links = ctx.knowledge_objects.slice(0, 3);
    for (const k of links) {
      await tx
        .insert(orderKnowledgeLinks)
        .values({
          order_id: order.id,
          knowledge_id: k.id,
          injection_type: "implicit",
        })
        .catch(() => null);
    }

    return order.id;
  });

  await insertGenerationLog({
    blueprintId: params.blueprintId,
    userId: params.userId,
    generationTrigger: params.generationTrigger,
    generationMode: params.generationMode,
    conditionAtGeneration: enforcement.condition_code,
    enforcementPackageId: ctx.enforcement_package_id,
    capabilityLevel: ctx.capability.level,
    domainAtGeneration: domainGen,
    inputJson: { task_type: taskType, difficulty },
    orderIds: [orderId],
    ordersGenerated: 1,
    usedFallback,
    aiUsed: usedBhudhi,
  });

  if (taskType === "execution" && ctx.action) {
    await db
      .update(actions)
      .set({ status: "pending" })
      .where(eq(actions.id, ctx.action.id))
      .catch(() => null);
  }

  logger.info(
    { blueprintId: params.blueprintId, orderId, taskType, difficulty, usedBhudhi },
    "[TaskEngine] Order created",
  );

  return { orders_generated: 1, order_ids: [orderId], used_bhudhi: usedBhudhi, used_fallback: usedFallback };
}

/** Legacy class wrapper */
export class TaskGenerationEngine {
  async generate(
    params: Parameters<typeof generate>[0],
  ): Promise<GenerationResult> {
    return generate(params);
  }
}
