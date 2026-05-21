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
  feedback,
  knowledgeObjects,
  orderKnowledgeLinks,
  taskGenerationLog,
  featureFlags,
  weeklyReviews,
  habits,
  habitCheckins,
  trendIntelligence,
  narrativeIntelligence,
} from "@workspace/db";
import { eq, and, or, desc, gte, inArray, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { TorgimaError } from "../../lib/errors.js";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import { RealityIntelligenceEngine } from "../intelligence/RealityIntelligenceEngine.js";
import {
  CommandOrderIntelligenceEngine,
  buildServerTraceChain,
  type CommandTraceChain,
} from "../intelligence/CommandOrderIntelligenceEngine.js";
import { buildTraceMetadata, getTierRules, parseMode, parseTier } from "../blueprint/BlueprintRuleEngine.js";
import {
  applyOrderTemplate,
  getOrderTemplate,
  type OrderTemplateKind,
} from "../blueprint/infrastructure/OrderTemplateSystem.js";
import { validateAIGeneratedObject } from "../blueprint/infrastructure/AIGenerationContracts.js";
import { selectKnowledgeLinksForOrder } from "../blueprint/infrastructure/KnowledgeObjectRules.js";
import { getOpenFlags } from "../outcome/OutcomeValidationEngine.js";
import { getBehavioralProfile } from "../../bhudhi/agents/ConditionAgent.js";
import {
  hasBlockingGap,
  inferSkillFromActionType,
} from "../academy/CapabilityGapEngine.js";
import { getBasicProfile } from "../../bhudhi/agents/BehavioralAgent.js";
import { selectPackage, packageToInjection } from "../../bhudhi/agents/KnowledgeAgent.js";
import { fetchRecoveryCoachingCopy } from "../../bhudhi/AdvancedIntelligenceBridge.js";
import { MemoryWriter } from "../../bhudhi/MemoryWriter.js";
import { enforceCapabilityDifficulty } from "../capability/CapabilityDifficulty.js";

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

  const [lastWeekly] = await db
    .select({ created_at: weeklyReviews.created_at })
    .from(weeklyReviews)
    .where(and(eq(weeklyReviews.blueprint_id, blueprintId), eq(weeklyReviews.user_id, userId)))
    .orderBy(desc(weeklyReviews.created_at))
    .limit(1);

  const daysSinceWeeklyReview = lastWeekly?.created_at
    ? (Date.now() - lastWeekly.created_at.getTime()) / 86400000
    : 999;

  const [{ blockedOpenCount = 0 } = { blockedOpenCount: 0 }] = await db
    .select({ blockedOpenCount: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, blueprintId),
        eq(orders.user_id, userId),
        eq(orders.status, "blocked"),
      ),
    );

  const [latestFeedback] = await db
    .select({
      completion_status: feedback.completion_status,
      blocker_json: feedback.blocker_json,
      failure_classification: feedback.failure_classification,
      failure_correction_type: feedback.failure_correction_type,
    })
    .from(feedback)
    .where(and(eq(feedback.blueprint_id, blueprintId), eq(feedback.user_id, userId)))
    .orderBy(desc(feedback.created_at))
    .limit(1);

  const activeHabitRows = await db
    .select()
    .from(habits)
    .where(
      and(eq(habits.blueprint_id, blueprintId), eq(habits.user_id, userId), eq(habits.active, true)),
    );

  let habitCheckinDue = false;
  for (const h of activeHabitRows) {
    const [lastCh] = await db
      .select({ created_at: habitCheckins.created_at })
      .from(habitCheckins)
      .where(eq(habitCheckins.habit_id, h.id))
      .orderBy(desc(habitCheckins.created_at))
      .limit(1);

    const freq = (h.frequency ?? "daily").toLowerCase();
    const intervalH = freq === "weekly" ? 24 * 7 - 4 : 20;
    if (!lastCh) {
      habitCheckinDue = true;
      break;
    }
    const hoursSince = (Date.now() - lastCh.created_at.getTime()) / 3600000;
    if (hoursSince >= intervalH) {
      habitCheckinDue = true;
      break;
    }
  }

  let taskLimits = (pkg.task_limits as { min?: number; max?: number }) ?? { min: 1, max: 3 };
  const tierRules = getTierRules(parseTier(blueprint.tier));
  const tierMax = tierRules.maxDailyOrders;
  taskLimits = {
    min: Math.min(taskLimits.min ?? 1, tierMax),
    max: Math.min(taskLimits.max ?? tierMax, tierMax),
  };
  const overrideFlags = (pkg.override_flags as Record<string, unknown>) ?? {};

  const allowedRaw = pkg.allowed_actions;
  const allowed_actions: string[] = Array.isArray(allowedRaw)
    ? allowedRaw.map((a) => String(a))
    : typeof allowedRaw === "string"
      ? [allowedRaw]
      : [];

  const openFalseProgress = await getOpenFlags(blueprintId);
  const falseProgressFlag = openFalseProgress[0] ?? null;

  return {
    blueprint: {
      id: blueprint.id,
      goal: blueprint.goal,
      purpose: blueprint.purpose ?? undefined,
      current_domain: blueprint.current_domain ?? undefined,
      current_condition: blueprint.current_condition ?? undefined,
      tier: blueprint.tier ?? undefined,
      mode: blueprint.mode ?? undefined,
    },
    plan: currentPlan,
    phase: currentPhase,
    project: currentProject,
    action: nextAction,
    target: currentTarget,
    enforcement: {
      task_limits: { min: taskLimits.min ?? 1, max: taskLimits.max ?? 3 },
      difficulty_cap: pkg.difficulty_cap as string,
      allowed_actions,
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
      difficulty_recommendation: (capability?.current_difficulty as string) ?? "easy",
    },
    knowledge_objects: knowledgeRows,
    recent_task_hashes: recentOrders.map((o) => o.content_hash).filter(Boolean) as string[],
    enforcement_package_id: pkg.id,
    generation_mode: params.generationMode,
    generation_trigger: params.generationTrigger,
    days_since_weekly_review: daysSinceWeeklyReview,
    blocked_open_count: blockedOpenCount ?? 0,
    habit_checkin_due: habitCheckinDue,
    has_active_habits: activeHabitRows.length > 0,
    false_progress_flag: falseProgressFlag,
    latest_feedback: latestFeedback ?? null,
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

function allowedAction(ctx: Awaited<ReturnType<typeof loadContext>>, key: string): boolean {
  const k = key.toLowerCase();
  return ctx.enforcement.allowed_actions.some((a) => String(a).toLowerCase() === k);
}

function buildPriorityCandidates(
  ctx: Awaited<ReturnType<typeof loadContext>>,
  primaryTaskType: string,
): Array<{ task_type: string; difficulty?: string | null }> {
  const seen = new Set<string>();
  const candidates: Array<{ task_type: string; difficulty?: string | null }> = [];
  const add = (task_type: string) => {
    if (seen.has(task_type)) return;
    seen.add(task_type);
    candidates.push({ task_type });
  };

  add(primaryTaskType);

  const latest = ctx.latest_feedback as { failure_correction_type?: string | null } | null;
  if (latest?.failure_correction_type) add(latest.failure_correction_type);

  if (ctx.false_progress_flag) {
    add("clarification");
    add("review");
  }
  if ((ctx.blocked_open_count ?? 0) > 0) add("blocker_resolution");

  return candidates;
}

function selectTaskType(ctx: Awaited<ReturnType<typeof loadContext>>): string {
  const { enforcement, phase, action, generation_mode } = ctx;

  const latestFb = ctx.latest_feedback as {
    completion_status?: string;
    blocker_json?: Record<string, unknown> | null;
    failure_classification?: string | null;
    failure_correction_type?: string | null;
  } | null;
  if (
    latestFb?.completion_status === "failed" ||
    latestFb?.completion_status === "skipped"
  ) {
    const classifiedType = latestFb.failure_correction_type?.trim();
    if (classifiedType) return classifiedType;

    const blocker = (latestFb.blocker_json ?? {}) as Record<string, unknown>;
    const hasBlocker = Boolean(blocker.had_blocker || blocker.blocker_type);
    if (hasBlocker || (ctx.blocked_open_count ?? 0) > 0) return "blocker_resolution";
    if (latestFb.failure_classification === "CAPABILITY_FAILURE") return "academy";
    if (latestFb.failure_classification === "CLARITY_FAILURE") return "clarification";
    if (generation_mode === "recovery" || generation_mode === "post_feedback") return "recovery";
  }

  const fp = ctx.false_progress_flag as {
    detection_type?: string;
    evidence_json?: Record<string, unknown>;
  } | null;
  if (fp?.detection_type) {
    const correction =
      (fp.evidence_json?.correction_task_type as string | undefined) ??
      fp.detection_type;
    if (correction.includes("evidence") || correction === "CLAIM_CONTRADICTED") return "clarification";
    if (correction.includes("refocus") || correction === "WRONG_WORK") return "clarification";
    if (correction.includes("root_cause") || correction === "ACTIVITY_WITHOUT_OUTCOME") return "review";
    if (correction.includes("dependency") || correction === "AVOIDANCE_LOOP") return "blocker_resolution";
    return "recovery";
  }

  if (generation_mode === "recovery" || enforcement.recovery_required) return "recovery";

  if (phase?.status === "gated") return "phase_checkpoint";

  if ((ctx.blocked_open_count ?? 0) > 0) return "blocker_resolution";

  const capabilityGap =
    enforcement.difficulty_cap === "hard" ||
    enforcement.difficulty_cap === "very_hard" ||
    ctx.capability.level === "beginner" ||
    (ctx.capability.execution_quality ?? 0) < 0.45 ||
    (ctx.capability.consistency ?? 0) < 0.4;

  if (capabilityGap && allowedAction(ctx, "academy_tasks")) return "academy";

  if ((ctx.days_since_weekly_review ?? 0) >= 7 && allowedAction(ctx, "weekly_review")) return "review";

  if (ctx.habit_checkin_due && ctx.has_active_habits && allowedAction(ctx, "habit_checkins")) {
    return "habit";
  }

  if (!action && !ctx.project) return "clarification";

  return "execution";
}

// ── DIFFICULTY SELECTION ──────────────────────────────────────────────────────

function selectDifficulty(params: {
  difficulty_cap: string;
  difficulty_recommendation: string;
  capability_level: string;
  execution_quality: number;
  consistency: number;
  action_type?: string | null;
  generation_mode: string;
  current_streak: number;
  is_first_in_phase: boolean;
}): string {
  // Recovery tasks stay deliberately lightweight (verification: difficulty very_easy).
  if (params.generation_mode === "recovery") {
    return "very_easy";
  }

  const base = enforceCapabilityDifficulty({
    difficultyRecommendation: params.difficulty_recommendation,
    difficultyCap: params.difficulty_cap,
    capabilityLevel: params.capability_level,
    executionQuality: params.execution_quality,
    consistency: params.consistency,
  });

  if (params.generation_mode === "initial") {
    return enforceCapabilityDifficulty({
      difficultyRecommendation: "easy",
      difficultyCap: params.difficulty_cap,
      capabilityLevel: params.capability_level,
      executionQuality: params.execution_quality,
      consistency: params.consistency,
    });
  }

  if (params.is_first_in_phase) {
    return enforceCapabilityDifficulty({
      difficultyRecommendation: "easy",
      difficultyCap: base,
      capabilityLevel: params.capability_level,
      executionQuality: params.execution_quality,
      consistency: params.consistency,
    });
  }

  const hardActionTypes = ["analyze", "improve", "standardize", "build", "publish", "validate"];
  if (params.action_type && hardActionTypes.includes(params.action_type)) {
    return base;
  }

  if (params.current_streak >= 7) return base;

  return base;
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
  domain?: string | null;
}): BuiltContent {
  const { task_type, goal, action, target, phase, project, difficulty, domain } = params;

  const templates: Record<string, () => BuiltContent> = {
    execution: () =>
      buildExecutionCommandContent({
        goal,
        action,
        phase,
        project,
        domain,
        difficulty,
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

    academy: () => {
      const label = truncate(goal, 60);
      return {
        title: `Capability Development: ${label}`,
        instruction: `Apply the execution skill needed for: "${truncate(goal, 200)}". Complete:\n1. One deliberate practice repetition\n2. Document what changed in your output\n3. Submit mastery evidence if required`,
        expected_output: "Documented capability application with measurable output.",
        definition_of_done:
          "Capability applied with evidence — not passive consumption. One concrete artifact produced.",
        why_it_matters:
          "Capability gaps block execution continuity. Deliberate skill progression removes the blocker.",
        time_estimate_minutes: 30,
        proof_required: true,
        proof_type: "text",
        proof_description: "Submit work sample or reflection proving capability application.",
      };
    },

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

export function buildDeterministicTaskCopy(params: {
  domain?: string;
  actionType?: string;
  condition?: string;
}): { title: string; instruction: string; expectedOutput: string } {
  const domain = params.domain ?? "Execution";
  const action = params.actionType ?? "Create";
  return {
    title: `${action} ${domain} execution artifact`,
    instruction: `${action} one ${domain.toLowerCase()} artifact with a clear hook, execution proof, and completion evidence.`,
    expectedOutput: "One concrete output with proof of work.",
  };
}

async function loadLatestEISTaskHint(userId: string): Promise<string | null> {
  const [trend] = await db
    .select({ opportunity_windows: trendIntelligence.opportunity_windows })
    .from(trendIntelligence)
    .where(eq(trendIntelligence.user_id, userId))
    .orderBy(desc(trendIntelligence.created_at))
    .limit(1)
    .catch(() => []);
  const [narrative] = await db
    .select({ content_angle: narrativeIntelligence.content_angle })
    .from(narrativeIntelligence)
    .where(eq(narrativeIntelligence.user_id, userId))
    .orderBy(desc(narrativeIntelligence.created_at))
    .limit(1)
    .catch(() => []);

  const windows = (trend?.opportunity_windows as Array<{ trend?: string; timeWindow?: string }> | undefined) ?? [];
  const first = windows[0];
  if (!first && !narrative?.content_angle) return null;
  const trendText = first ? `Execution Window: ${first.trend ?? "market signal"} (${first.timeWindow ?? "This week"}).` : "";
  const angleText = narrative?.content_angle ? ` Audience Intelligence: ${narrative.content_angle}.` : "";
  return `${trendText}${angleText}`.trim();
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

function buildCommandInstruction(params: {
  domain: string;
  action?: { name: string; type: string } | null;
}): string {
  const domain = params.domain?.toLowerCase() ?? "business";
  void domain;
  const actionTitle = params.action?.name ?? "complete this task";

  const commandPrefixes = ["Execute:", "Action required:", "Complete now:", "Your order:", "Immediate action:"];
  const prefix = commandPrefixes[Math.floor(Math.random() * commandPrefixes.length)];

  return `${prefix} ${actionTitle}. This is a direct execution order — not a suggestion. Complete it within the time limit and submit proof when required.`;
}

function buildExpectedOutputCommand(params: {
  action?: { name: string; type: string } | null;
}): string {
  return `Completed ${params.action?.name ?? "this task"} with documented evidence of completion: a screenshot, link, written output, or measurable result that proves this was done.`;
}

function buildDefinitionOfDoneCommand(): string {
  return `This task is complete when: (1) The action has been physically executed, not just planned. (2) You have proof of completion ready if proof is required. (3) You can describe what changed as a result of doing this.`;
}

function buildWhyItMattersCommand(params: {
  goal: string;
  phase?: { name: string } | null;
  project?: { name: string } | null;
}): string {
  return `This task is part of ${params.phase?.name ?? "your current phase"} → ${params.project?.name ?? "your current project"} → your goal (${truncate(params.goal, 120)}). Skipping this delays your execution chain — every incomplete order sets the next one back.`;
}

function buildWhereContext(params: { domain: string | null | undefined }): string {
  const domain = params.domain?.toLowerCase() ?? "general";

  const platformMap: Record<string, string> = {
    genesis:      "Your primary tools, notebook, calendar, or the environment where you ship work",
    market:       "Your customer-facing channels, CRM, or growth stack",
    delivery:     "Your primary business tools, communication channels, or target platforms",
    continuity:   "Your tracking, journaling, or maintenance systems",

    business:     "Your primary business tools, communication channels, or target platforms",
    health:       "Your tracking app, gym, or health monitoring system",
    financial:    "Your financial accounts, spreadsheet, or investment platform",
    creative:     "Your creative tools, portfolio, or publishing platform",
    personal_growth: "Your learning platform, journal, or habit tracker",
    technology:   "Your development environment, GitHub, or deployment platform",
  };

  return platformMap[domain] ?? "The platform or environment most relevant to this action";
}

function buildHowContext(): string {
  return `Use the most direct path available. If you are stuck for more than 10 minutes, document the blocker and submit it in feedback anyway. Speed of execution matters more than perfection at this stage.`;
}

function buildExecutionCommandContent(params: {
  goal: string;
  action?: { name: string; type: string } | null;
  phase?: { name: string } | null;
  project?: { name: string } | null;
  domain: string | null | undefined;
  difficulty: string;
}): BuiltContent {
  const difficulty = params.difficulty;
  const timeLimit =
    ({
      very_easy: 15,
      easy: 30,
      moderate: 60,
      hard: 90,
      very_hard: 120,
    } as Record<string, number>)[difficulty] ?? difficultyTime(difficulty);

  const actionForVerb = params.action ?? { name: "Execute Next Action", type: "create" };

  const title = `${actionVerb(actionForVerb.type)}: ${truncate(actionForVerb.name, 60)}`;

  return {
    title,
    instruction: buildCommandInstruction({
      domain: String(params.domain ?? "business"),
      action: params.action,
    }),
    expected_output: buildExpectedOutputCommand({ action: params.action }),
    definition_of_done: buildDefinitionOfDoneCommand(),
    why_it_matters: buildWhyItMattersCommand({
      goal: params.goal,
      phase: params.phase,
      project: params.project,
    }),
    time_estimate_minutes: timeLimit,
    proof_required: difficulty === "hard" || difficulty === "very_hard",
    proof_type: difficulty === "hard" || difficulty === "very_hard" ? "image" : undefined,
    proof_description:
      difficulty === "hard" || difficulty === "very_hard"
        ? "Screenshot or link proving completion"
        : undefined,
  };
}

// ── BHUDHI ENRICHMENT ─────────────────────────────────────────────────────────

function commandOrderWhereHint(domain: string | null | undefined): string {
  const d = domain?.toLowerCase() ?? "genesis";
  const platformMap: Record<string, string> = {
    genesis: "Primary shipping surface: notes, calendar, or the tool you use to publish work",
    market: "Customer-visible channels or outbound stack",
    delivery: "Operational delivery toolchain",
    continuity: "Reflection, metrics, or maintenance systems",
    business: "Core business tooling or outreach channels",
    health: "Health tracking or physical training environment",
    financial: "Accounts, spreadsheets, or capital platforms",
    creative: "Studio or publishing environment",
    personal_growth: "Learning modality or journaling system",
    technology: "Repository, IDE, CI, or hosting surfaces",
  };
  return platformMap[d] ?? "Operational environment mapped to active domain";
}

function buildExecutionCommandContextSnapshot(
  content: BuiltContent,
  ctx: Awaited<ReturnType<typeof loadContext>>,
): Record<string, unknown> {
  const actionTitle = ctx.action?.name ?? ctx.target?.name ?? "Current action";
  const projectTitle = ctx.project?.name ?? "Current project";
  const phaseTitle = ctx.phase?.name ?? "Current phase";
  const planTitle = ctx.plan?.name ?? "Current plan";
  const domain = ctx.blueprint.current_domain ?? "genesis";
  const d = CommandOrderIntelligenceEngine.deterministicFallback({
    taskTitle: content.title,
    domain,
    actionTitle,
    projectTitle,
    phaseTitle,
    planTitle,
    goal: ctx.blueprint.goal,
    timeEstimateMinutes: content.time_estimate_minutes ?? 45,
  });
  const traceChain = buildServerTraceChain({
    taskTitle: content.title,
    actionTitle,
    projectTitle,
    phaseTitle,
    planTitle,
    goal: ctx.blueprint.goal,
  });
  return {
    where: d.where,
    how: d.how,
    proof: d.proof,
    unlockConsequence: d.unlockConsequence,
    traceChain,
    aiPromptIfNeeded: d.aiPromptIfNeeded ?? null,
    platformIfNeeded: d.platformIfNeeded ?? null,
  };
}

async function enrichWithBhudhi(params: {
  content: BuiltContent;
  ctx: Awaited<ReturnType<typeof loadContext>>;
  userId: string;
  taskType: string;
  difficulty: string;
  commandContext: Record<string, unknown>;
}): Promise<{ content: BuiltContent; commandContext: Record<string, unknown>; usedAi: boolean }> {
  const { ctx, userId, taskType, difficulty } = params;
  let next = { ...params.content };
  let commandContext = { ...params.commandContext };

  const blueprintId = ctx.blueprint.id;
  const intel = await RealityIntelligenceEngine.retrieveNormalized(blueprintId);
  const intelligenceHint = intel?.executionImplication ?? "";

  const actionTitle = ctx.action?.name ?? ctx.target?.name ?? "Current action";
  const projectTitle = ctx.project?.name ?? "Current project";
  const phaseTitle = ctx.phase?.name ?? "Current phase";
  const planTitle = ctx.plan?.name ?? "Current plan";
  const domain = ctx.blueprint.current_domain ?? "genesis";

  const traceChain: CommandTraceChain =
    (commandContext.traceChain as CommandTraceChain | undefined) ??
    buildServerTraceChain({
      taskTitle: next.title,
      actionTitle,
      projectTitle,
      phaseTitle,
      planTitle,
      goal: ctx.blueprint.goal,
    });

  const [bp] = await db
    .select({ state_version: blueprints.state_version })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  const commandOrderMode = taskType === "execution";

  const conditionProfile = await getBehavioralProfile(userId, blueprintId);
  const behavioralProfile = await getBasicProfile(userId);
  const knowledgePackage = await selectPackage({
    domain,
    actionType: ctx.action?.type ?? "Create",
    userId,
  });

  const result = await routeBhudhiRequest({
    sourceEngine:   "TaskGenerationEngine",
    triggerType:    "TASK_DRAFTING",
    userId,
    blueprintId,
    stateVersion:   bp?.state_version ?? 0,
    idempotencyKey: `task_draft:${blueprintId}:${Date.now()}`,
    facts: {
      goal:           ctx.blueprint.goal,
      domain,
      taskType,
      actionContext:  actionTitle,
      actionTitle,
      projectTitle,
      phaseTitle,
      planTitle,
      taskTitle:      next.title,
      difficulty,
      proofType:      next.proof_type ?? "none",
      condition:
        ctx.enforcement.condition_code ??
        ctx.blueprint.current_condition ??
        "nothingness",
      conditionTone: conditionProfile.taskTone,
      taskLanguageTone: conditionProfile.taskTone,
      behavioralProfile,
      knowledgePackage: knowledgePackage ? packageToInjection(knowledgePackage) : null,
      controlRule: {
        maxDifficulty: conditionProfile.maxDifficulty,
        maxActiveTasks: conditionProfile.maxActiveTasks,
      },
      allowedActions: ctx.enforcement.allowed_actions,
      timeEstimateMinutes: next.time_estimate_minutes ?? 45,
      intelligenceHint,
      commandOrderMode,
      whereHint: commandOrderWhereHint(domain),
      stateVersion: bp?.state_version ?? 0,
    },
  });

  if (!result.ok || !result.output) {
    return { content: next, commandContext: { ...commandContext, traceChain }, usedAi: false };
  }

  const d = result.output.data as Record<string, unknown>;
  const hasCommand = typeof d["command"] === "string" && String(d["command"]).trim().length > 0;

  if (commandOrderMode && hasCommand) {
    next = {
      ...next,
      title:              String(d["title"] ?? next.title).slice(0, 500),
      instruction:        String(d["command"]),
      expected_output:    String(d["requiredOutput"] ?? next.expected_output),
      definition_of_done: String(d["doneCriteria"] ?? next.definition_of_done),
      why_it_matters: String(d["userFacingReason"] ?? next.why_it_matters),
      proof_description: d["proofInstruction"]
        ? String(d["proofInstruction"])
        : next.proof_description,
    };
    commandContext = {
      ...commandContext,
      where: String(d["where"] ?? commandContext.where),
      how: String(d["how"] ?? commandContext.how),
      proof: String(d["proof"] ?? commandContext.proof),
      unlockConsequence: String(d["unlockConsequence"] ?? commandContext.unlockConsequence),
      traceChain,
      aiPromptIfNeeded: d["aiPromptIfNeeded"] ?? null,
      platformIfNeeded: d["platformIfNeeded"] ?? null,
    };
    return { content: next, commandContext, usedAi: true };
  }

  if (!d["title"] || !d["instruction"]) {
    return { content: next, commandContext: { ...commandContext, traceChain }, usedAi: false };
  }

  next = {
    ...next,
    title:            String(d["title"]),
    instruction:      String(d["instruction"]),
    why_it_matters:   String(d["userFacingReason"] ?? next.why_it_matters),
    proof_description: d["proofInstruction"]
      ? String(d["proofInstruction"])
      : next.proof_description,
  };
  return { content: next, commandContext: { ...commandContext, traceChain }, usedAi: true };
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
  const { isBlueprintExecutionLocked } = await import("../health/ExecutionLock.js");
  const lock = await isBlueprintExecutionLocked(params.blueprintId);
  if (lock.locked) {
    throw new TorgimaError(
      "FEATURE_DISABLED",
      lock.message ?? "Task generation blocked until health issue is resolved",
      false,
    );
  }

  const genModeNorm = normalizeGenerationMode(params.generationMode);
  const genTrigNorm = normalizeGenerationTrigger(params.generationTrigger);

  const ctx = await loadContext({
    ...params,
    generationMode: genModeNorm,
    generationTrigger: genTrigNorm,
  });

  let { enforcement } = ctx;

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
            inArray(orders.status, ["pending", "active"]),
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
  const priorityCandidates = buildPriorityCandidates(ctx, taskType);
  if (priorityCandidates.length > 1) {
    const { priorityEngine } = await import("../priority/PriorityEngine.js");
    const { tracePrioritySelection, getBlueprintStateVersion } = await import(
      "../decision-trace/DecisionTraceSystem.js"
    );
    const scored = priorityEngine.scoreAll(priorityCandidates, {
      condition: ctx.enforcement.condition_code ?? "stability",
      capability: { difficulty_recommendation: ctx.capability.difficulty_recommendation },
      falseProgressActive: Boolean(ctx.false_progress_flag),
    });
    const best = scored[0]!.candidate;
    taskType = best.task_type;
    await tracePrioritySelection({
      blueprintId: params.blueprintId,
      userId: params.userId,
      condition: ctx.enforcement.condition_code ?? "stability",
      selectedTaskType: taskType,
      candidates: scored.map((s) => ({ task_type: s.candidate.task_type, score: s.score })),
      stateVersion: await getBlueprintStateVersion(params.blueprintId),
    });
  }

  const requiredSkill = inferSkillFromActionType(
    ctx.action?.type ?? null,
    ctx.blueprint.current_domain,
  );
  if (requiredSkill && (await hasBlockingGap(params.userId, requiredSkill))) {
    taskType = "academy";
  } else if (requiredSkill && taskType === "execution") {
    const capIdx = (DIFFICULTY_ORDER as readonly string[]).indexOf(enforcement.difficulty_cap);
    const reducedIdx = Math.max(0, capIdx - 1);
    if (reducedIdx < capIdx) {
      enforcement = { ...enforcement, difficulty_cap: DIFFICULTY_ORDER[reducedIdx]! };
    }
  }

  const isFirstInPhase =
    ctx.phase?.status === "active" && countActive === 0;
  let difficulty = selectDifficulty({
    difficulty_cap: enforcement.difficulty_cap,
    difficulty_recommendation: ctx.capability.difficulty_recommendation,
    capability_level: ctx.capability.level,
    execution_quality: ctx.capability.execution_quality,
    consistency: ctx.capability.consistency,
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
    domain: ctx.blueprint.current_domain ?? null,
  });
  const eisTaskHint = await loadLatestEISTaskHint(params.userId);
  if (eisTaskHint && taskType === "execution") {
    content = {
      ...content,
      instruction: `${content.instruction}\n\nCurrent market context: ${eisTaskHint}`,
      why_it_matters: `${content.why_it_matters} Recent EIS context is included as awareness, not direction.`,
    };
  }

  let usedBhudhi = false;
  let usedFallback = false;

  let commandContext: Record<string, unknown> =
    taskType === "execution" ? buildExecutionCommandContextSnapshot(content, ctx) : {};

  const [aiFlag] = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(eq(featureFlags.feature_name, "ai_enabled"))
    .limit(1);

  const bhudhiEligibleTypes = new Set([
    "execution",
    "academy",
    "review",
    "habit",
    "phase_checkpoint",
    "blocker_resolution",
  ]);

  if (taskType === "recovery" && aiFlag?.enabled) {
    try {
      const failureReason =
        ctx.latest_feedback?.completion_status === "failed"
          ? JSON.stringify(ctx.latest_feedback.blocker_json ?? {})
          : undefined;
      const [bpRow] = await db
        .select({ state_version: blueprints.state_version })
        .from(blueprints)
        .where(eq(blueprints.id, params.blueprintId))
        .limit(1);
      const coaching = await fetchRecoveryCoachingCopy({
        userId: params.userId,
        blueprintId: params.blueprintId,
        stateVersion: bpRow?.state_version ?? 0,
        goal: ctx.blueprint.goal,
        currentCondition:
          ctx.enforcement.condition_code ?? ctx.blueprint.current_condition ?? "stability",
        failureReason,
      });
      content = {
        ...content,
        title: coaching.title,
        instruction: coaching.instruction,
        expected_output: coaching.expectedOutput,
      };
      if (coaching.usedBhudhi) usedBhudhi = true;
      if (coaching.fallbackUsed) usedFallback = true;

      await MemoryWriter.write({
        userId: params.userId,
        blueprintId: params.blueprintId,
        memoryType: "RECOVERY_CONTEXT",
        scope: "BLUEPRINT",
        content: coaching.instruction.slice(0, 400),
        sourceType: "FEEDBACK",
        confidence: "MEDIUM",
        relevanceScore: 0.7,
        expiresInDays: 14,
      }).catch(() => null);
    } catch {
      usedFallback = true;
    }
  } else if (taskType === "academy" && aiFlag?.enabled) {
    try {
      const [bpRow] = await db
        .select({ state_version: blueprints.state_version })
        .from(blueprints)
        .where(eq(blueprints.id, params.blueprintId))
        .limit(1);
      const academy = await routeBhudhiRequest({
        sourceEngine: "TaskGenerationEngine",
        triggerType: "ACADEMY_SUPPORT",
        userId: params.userId,
        blueprintId: params.blueprintId,
        stateVersion: bpRow?.state_version ?? 0,
        idempotencyKey: `academy_task:${params.blueprintId}:${Date.now()}`,
        facts: {
          goal: ctx.blueprint.goal,
          skillCategory: requiredSkill ?? "execution",
          capabilityGap: requiredSkill ?? "execution",
          currentSkillLevel: ctx.capability.level,
        },
      });
      if (academy.ok && academy.output?.data) {
        const d = academy.output.data as Record<string, unknown>;
        content = {
          ...content,
          title: String(d.title ?? content.title).slice(0, 200),
          instruction: String(d.instruction ?? content.instruction).slice(0, 800),
        };
        usedBhudhi = !academy.fallbackUsed;
        if (academy.fallbackUsed) usedFallback = true;
      }
    } catch {
      usedFallback = true;
    }
  } else if (aiFlag?.enabled && bhudhiEligibleTypes.has(taskType)) {
    try {
      const enriched = await Promise.race([
        enrichWithBhudhi({
          content,
          ctx,
          userId: params.userId,
          taskType,
          difficulty,
          commandContext,
        }),
        new Promise<{ content: BuiltContent; commandContext: Record<string, unknown>; usedAi: boolean }>(
          (_, reject) => setTimeout(() => reject(new Error("timeout")), 5000),
        ),
      ]);
      content = enriched.content;
      commandContext = enriched.commandContext;
      if (enriched.usedAi) usedBhudhi = true;
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
      domain: ctx.blueprint.current_domain ?? null,
    });
    content.instruction += `\n\n(unique ref: ${Date.now()})`;
    hash = buildContentHash(content.title, content.instruction);
    commandContext = {};
  }

  const tier = parseTier(ctx.blueprint.tier);
  const templateKind = orderTemplateKindForTaskType(taskType);
  const templated = applyOrderTemplate(tier, templateKind, {
    title: content.title,
    instruction: content.instruction,
  });
  content = {
    ...content,
    title: templated.title,
    instruction: templated.instruction,
    proof_required: content.proof_required || templated.proofRequired,
  };
  const orderContractCheck = validateAIGeneratedObject("order", {
    layer: "order",
    title: content.title,
    instruction: content.instruction,
    definitionOfDone: content.definition_of_done,
    difficulty,
  });
  if (!orderContractCheck.valid) {
    throw new TorgimaError(
      "VALIDATION_ERROR",
      `Generated order failed AI contract: ${orderContractCheck.errors.join("; ")}`,
    );
  }
  const orderTemplate = getOrderTemplate(tier, templateKind);
  commandContext = {
    ...commandContext,
    orderTemplateId: templated.templateId,
    orderTemplateTone: orderTemplate.tone,
    orderTemplateDepth: orderTemplate.detailDepth,
  };

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
        assigned_member_id: params.userId,
        trace_metadata: buildTraceMetadata({
          layer: "order",
          parentId: ctx.action?.id ?? ctx.project?.id ?? null,
          parentLayer: ctx.action ? "action" : "project",
          tier: parseTier(ctx.blueprint.tier),
          mode: parseMode(ctx.blueprint.mode),
          generationReason: `${params.generationTrigger}:${params.generationMode}`,
        }),
        status: "pending",
        command_context: commandContext as typeof orders.$inferInsert["command_context"],
      })
      .returning({ id: orders.id });

    if (!order) throw new Error("Failed to create order");

    const links = selectKnowledgeLinksForOrder(ctx.knowledge_objects, tier);
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

    await tx.insert(taskGenerationLog).values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      generation_trigger: normalizeGenerationTrigger(params.generationTrigger),
      generation_mode: normalizeGenerationMode(params.generationMode),
      condition_at_generation: enforcement.condition_code,
      enforcement_package_id: ctx.enforcement_package_id,
      capability_level: ctx.capability.level,
      domain_at_generation: domainGen,
      input_json: { task_type: taskType, difficulty },
      orders_generated: 1,
      order_ids: [order.id],
      used_fallback: usedFallback,
      ai_used: usedBhudhi,
    });

    return order.id;
  });

  if (taskType === "execution" && ctx.action) {
    await db
      .update(actions)
      .set({ status: "active" })
      .where(eq(actions.id, ctx.action.id))
      .catch(() => null);
  }

  logger.info(
    { blueprintId: params.blueprintId, orderId, taskType, difficulty, usedBhudhi },
    "[TaskEngine] Order created",
  );

  return { orders_generated: 1, order_ids: [orderId], used_bhudhi: usedBhudhi, used_fallback: usedFallback };
}

function orderTemplateKindForTaskType(taskType: string): OrderTemplateKind {
  if (taskType === "recovery") return "recovery";
  if (taskType === "blocker_resolution") return "analysis";
  if (taskType === "phase_checkpoint") return "validation";
  if (taskType === "weekly_review") return "optimization";
  return "execution";
}

/** Legacy class wrapper */
export class TaskGenerationEngine {
  async generate(
    params: Parameters<typeof generate>[0],
  ): Promise<GenerationResult> {
    return generate(params);
  }
}
