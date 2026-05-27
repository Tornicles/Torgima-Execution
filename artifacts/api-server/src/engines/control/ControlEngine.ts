import {
  blueprints,
  db,
  users,
  capabilityProfiles,
  orders,
  enforcementPackages,
  cognitiveLoadScores,
  signalSnapshots,
} from "@workspace/db";
import {
  applyArchetypeTaskLimitsWithLog,
  emitArchetypeContextMissingIfNeeded,
  loadBlueprintArchetypeContext,
} from "../erector/ArchetypeExecutionContext.js";
import { eq, and, inArray, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { incrementStateVersion } from "../../services/StateMutationService.js";
import type { EnforcementPackage } from "../../types/enforcement.js";
import type { SignalState } from "../../types/signal.js";
import type { Blueprint } from "../../types/blueprint.js";
import { getConditionContract } from "../blueprint/infrastructure/ConditionEnforcementMatrix.js";
import { getActivePatterns } from "../pattern/PatternLearningEngine.js";
import { applyTierToConditionRules } from "../../services/TierDifferentiationService.js";

// ── BASE RULES PER CONDITION ─────────────────────────────────────────────────

export interface BaseConditionRules {
  taskMin: number;
  taskMax: number;
  difficultyCap: string;
  allowedActions: string[];
  blockedActions: string[];
  phasePermission: string;
  aiMode: string;
  uiMode: string;
  riskLevel: string;
  recoveryRequired: boolean;
  scalingAllowed: boolean;
}

const CONDITION_BASE_RULES: Record<string, BaseConditionRules> = {
  nothingness: {
    taskMin: 3,
    taskMax: 3,
    difficultyCap: "easy",
    allowedActions: ["task_execution", "feedback_submission", "academy_tasks"],
    blockedActions: ["scaling_operations", "target_expansion", "phase_checkpoint"],
    phasePermission: "restricted",
    aiMode: "command",
    uiMode: "starter",
    riskLevel: "low",
    recoveryRequired: false,
    scalingAllowed: false,
  },
  danger: {
    taskMin: 3,
    taskMax: 3,
    difficultyCap: "very_easy",
    allowedActions: ["task_execution", "feedback_submission", "academy_tasks"],
    blockedActions: [
      "scaling_operations",
      "target_expansion",
      "phase_checkpoint",
      "habit_checkins",
      "weekly_review",
    ],
    phasePermission: "blocked",
    aiMode: "correction",
    uiMode: "restrictive",
    riskLevel: "critical",
    recoveryRequired: true,
    scalingAllowed: false,
  },
  urgency: {
    taskMin: 6,
    taskMax: 6,
    difficultyCap: "easy",
    allowedActions: [
      "task_execution",
      "feedback_submission",
      "academy_tasks",
      "habit_checkins",
      "weekly_review",
      "knowledge_library",
    ],
    blockedActions: ["scaling_operations", "target_expansion"],
    phasePermission: "restricted",
    aiMode: "stabilization",
    uiMode: "focused",
    riskLevel: "high",
    recoveryRequired: false,
    scalingAllowed: false,
  },
  stability: {
    taskMin: 9,
    taskMax: 9,
    difficultyCap: "moderate",
    allowedActions: [
      "task_execution",
      "feedback_submission",
      "academy_tasks",
      "habit_checkins",
      "weekly_review",
      "phase_checkpoint",
      "knowledge_library",
      "blueprint_analytics",
      "signal_history",
      "framework_view",
    ],
    blockedActions: ["scaling_operations", "target_expansion"],
    phasePermission: "normal",
    aiMode: "optimization",
    uiMode: "standard",
    riskLevel: "medium",
    recoveryRequired: false,
    scalingAllowed: false,
  },
  power: {
    taskMin: 12,
    taskMax: 12,
    difficultyCap: "hard",
    allowedActions: [
      "task_execution",
      "feedback_submission",
      "academy_tasks",
      "habit_checkins",
      "weekly_review",
      "phase_checkpoint",
      "knowledge_library",
      "blueprint_analytics",
      "signal_history",
      "scaling_operations",
      "target_expansion",
      "framework_view",
    ],
    blockedActions: [],
    phasePermission: "accelerated",
    aiMode: "expansion",
    uiMode: "expanded",
    riskLevel: "low",
    recoveryRequired: false,
    scalingAllowed: true,
  },
  affluence: {
    taskMin: 12,
    taskMax: 12,
    difficultyCap: "very_hard",
    allowedActions: [
      "task_execution",
      "feedback_submission",
      "academy_tasks",
      "habit_checkins",
      "weekly_review",
      "phase_checkpoint",
      "knowledge_library",
      "blueprint_analytics",
      "signal_history",
      "scaling_operations",
      "target_expansion",
      "framework_view",
      "milestone_history",
    ],
    blockedActions: [],
    phasePermission: "accelerated",
    aiMode: "strategic",
    uiMode: "strategic",
    riskLevel: "low",
    recoveryRequired: false,
    scalingAllowed: true,
  },
  power_change: {
    taskMin: 6,
    taskMax: 6,
    difficultyCap: "moderate",
    allowedActions: [
      "task_execution",
      "feedback_submission",
      "academy_tasks",
      "knowledge_library",
      "framework_view",
      "signal_history",
    ],
    blockedActions: ["scaling_operations", "target_expansion", "phase_checkpoint"],
    phasePermission: "blocked",
    aiMode: "analytical",
    uiMode: "transitional",
    riskLevel: "medium",
    recoveryRequired: false,
    scalingAllowed: false,
  },
};

const DIFFICULTY_LEVELS = ["very_easy", "easy", "moderate", "hard", "very_hard"];

function applyTierOverrides(base: BaseConditionRules, tier: string): BaseConditionRules {
  return applyTierToConditionRules(base, tier);
}

function applyCapabilityModifier(base: BaseConditionRules, capabilityLevel: string): BaseConditionRules {
  const result = { ...base };
  const levelAdjustments: Record<string, number> = {
    beginner: -1,
    operator: 0,
    advanced: 0,
    lead: 1,
  };
  const adj = levelAdjustments[capabilityLevel] ?? 0;
  if (adj !== 0) {
    const capIdx = DIFFICULTY_LEVELS.indexOf(result.difficultyCap);
    const newIdx = Math.max(0, Math.min(DIFFICULTY_LEVELS.length - 1, capIdx + adj));
    result.difficultyCap = DIFFICULTY_LEVELS[newIdx];
  }
  return result;
}

/** Pattern evidence influences pacing — never overrides condition authority. */
async function applyPatternEvidenceModifier(
  base: BaseConditionRules,
  blueprintId: string,
  userId: string,
): Promise<BaseConditionRules> {
  const result = { ...base };
  const patterns = await getActivePatterns(userId, blueprintId).catch(() => []);

  for (const p of patterns) {
    const evidence =
      p.evidence_json && typeof p.evidence_json === "object" && !Array.isArray(p.evidence_json)
        ? (p.evidence_json as Record<string, unknown>)
        : {};
    const spec = String(evidence.spec_label ?? "");
    const fatigue = String(evidence.fatigue_risk_band ?? p.severity ?? "").toUpperCase();

    if (spec === "FATIGUE_RISK" && (fatigue === "HIGH" || fatigue === "CRITICAL")) {
      result.taskMax = Math.max(result.taskMin, result.taskMax - 1);
      const capIdx = DIFFICULTY_LEVELS.indexOf(result.difficultyCap);
      if (capIdx > 0) result.difficultyCap = DIFFICULTY_LEVELS[Math.max(0, capIdx - 1)];
      result.recoveryRequired = true;
    }

    if (spec === "ABANDONMENT_RISK") {
      result.taskMax = Math.max(1, Math.min(result.taskMax, 2));
    }
  }

  return result;
}

async function applyCognitiveLoadModifier(
  base: BaseConditionRules,
  blueprintId: string,
  userId: string,
): Promise<{ rules: BaseConditionRules; loadScore: number }> {
  const result = { ...base };

  const activeStatuses = ["pending", "active", "needs_feedback", "blocked"] as const;

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, blueprintId),
        eq(orders.user_id, userId),
        inArray(orders.status, [...activeStatuses]),
      ),
    );

  const activeTaskCount = count ?? 0;

  const loadScore = Math.min(activeTaskCount / 5, 1.0);

  await db
    .insert(cognitiveLoadScores)
    .values({
      blueprint_id: blueprintId,
      user_id: userId,
      load_score: loadScore,
      active_tasks: activeTaskCount,
      complexity_level: loadScore > 0.8 ? "high" : loadScore > 0.5 ? "medium" : "low",
      recommendation: loadScore >= 0.8 ? "reduce_load" : undefined,
    })
    .catch(() => null);

  if (loadScore >= 0.8) {
    result.taskMax = Math.max(result.taskMin, result.taskMax - 2);
  }

  return { rules: result, loadScore };
}

function buildFeaturePermissions(
  condition: string,
  tier: string,
  allowedActions: string[],
): Record<string, boolean> {
  const base: Record<string, boolean> = {
    task_execution: true,
    feedback_submission: true,
    academy_tasks: allowedActions.includes("academy_tasks"),
    habit_checkins: allowedActions.includes("habit_checkins"),
    weekly_review: allowedActions.includes("weekly_review"),
    phase_checkpoint: allowedActions.includes("phase_checkpoint"),
    knowledge_library: allowedActions.includes("knowledge_library"),
    blueprint_analytics: allowedActions.includes("blueprint_analytics"),
    signal_history: allowedActions.includes("signal_history"),
    scaling_operations: allowedActions.includes("scaling_operations"),
    target_expansion: allowedActions.includes("target_expansion"),
    framework_view: allowedActions.includes("framework_view"),
    identity_panel: allowedActions.includes("identity_panel") || condition !== "danger",
    milestone_history: allowedActions.includes("milestone_history"),
  };

  if (tier === "growth" || tier === "ultimate") {
    base.advanced_analytics = true;
    base.custom_policies = true;
  }
  if (tier === "ultimate") {
    base.predictive_signals = true;
  }

  return base;
}

export async function generateEnforcementPackage(params: {
  blueprintId: string;
  userId: string;
  conditionId: string;
  condition: string;
  signalSnapshotId?: string;
  escalationLevel: number;
  recoveryRequired: boolean;
  causationEventId?: string;
}): Promise<{ packageId: string }> {
  const [user] = await db
    .select({ tier: users.tier })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  const [capability] = await db
    .select({ level: capabilityProfiles.level })
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.user_id, params.userId))
    .limit(1);

  const tier = user?.tier ?? "starter";
  const capabilityLevel = capability?.level ?? "beginner";

  let rules = CONDITION_BASE_RULES[params.condition] ?? CONDITION_BASE_RULES.urgency;

  if (params.condition === "danger" && params.escalationLevel >= 2) {
    rules = { ...rules, taskMin: 2, taskMax: 2 };
  }

  rules = applyTierOverrides(rules, tier);
  rules = applyCapabilityModifier(rules, capabilityLevel);

  const { rules: rulesLoaded, loadScore } = await applyCognitiveLoadModifier(
    rules,
    params.blueprintId,
    params.userId,
  );
  rules = rulesLoaded;

  rules = await applyPatternEvidenceModifier(rules, params.blueprintId, params.userId);

  const bpArchetype = await loadBlueprintArchetypeContext(params.blueprintId);
  await emitArchetypeContextMissingIfNeeded({
    blueprintId: params.blueprintId,
    userId: params.userId,
    primaryArchetypeId: bpArchetype?.primaryArchetypeId,
    loop: "primary",
  });
  const baseMin = rules.taskMin;
  const baseMax = rules.taskMax;
  const adjusted = applyArchetypeTaskLimitsWithLog({
    blueprintId: params.blueprintId,
    baseMin,
    baseMax,
    archetypeExecutionMult: bpArchetype?.archetypeExecutionMult,
  });
  rules = { ...rules, taskMin: adjusted.min, taskMax: adjusted.max };

  const featurePermissions = buildFeaturePermissions(params.condition, tier, rules.allowedActions);

  if (rules.taskMin > rules.taskMax) {
    rules.taskMin = 1;
    rules.taskMax = Math.max(1, rules.taskMin);
  }

  const packageId = await db.transaction(async (tx) => {
    await tx
      .update(enforcementPackages)
      .set({ is_current: false })
      .where(
        and(
          eq(enforcementPackages.blueprint_id, params.blueprintId),
          eq(enforcementPackages.is_current, true),
        ),
      );

    const [pkg] = await tx
      .insert(enforcementPackages)
      .values({
        blueprint_id: params.blueprintId,
        condition_id: params.conditionId,
        signal_snapshot_id: params.signalSnapshotId ?? undefined,
        condition: params.condition as typeof enforcementPackages.$inferInsert["condition"],
        task_limits: { min: rules.taskMin, max: rules.taskMax },
        difficulty_cap: rules.difficultyCap as typeof enforcementPackages.$inferInsert["difficulty_cap"],
        allowed_actions: rules.allowedActions,
        blocked_actions: rules.blockedActions,
        phase_permission: rules.phasePermission as typeof enforcementPackages.$inferInsert["phase_permission"],
        ai_mode: rules.aiMode as typeof enforcementPackages.$inferInsert["ai_mode"],
        ui_mode: rules.uiMode as typeof enforcementPackages.$inferInsert["ui_mode"],
        feature_permissions: featurePermissions,
        risk_level: rules.riskLevel as typeof enforcementPackages.$inferInsert["risk_level"],
        override_flags: {
          recovery_required: params.recoveryRequired,
          scaling_allowed: rules.scalingAllowed,
          escalation_level: params.escalationLevel,
        },
        cognitive_load_score: loadScore,
        is_current: true,
      })
      .returning({ id: enforcementPackages.id });

    if (!pkg) throw new Error("Failed to create enforcement package");
    return pkg.id;
  });

  await incrementStateVersion(
    params.blueprintId,
    "enforcement_package_created",
    params.causationEventId,
  );

  logger.info(
    {
      blueprintId: params.blueprintId,
      condition: params.condition,
      tier,
      capability: capabilityLevel,
      taskMin: rules.taskMin,
      taskMax: rules.taskMax,
      difficultyCap: rules.difficultyCap,
      aiMode: rules.aiMode,
    },
    "[ControlEngine] Enforcement package created",
  );

  const { traceControlOutput, getBlueprintStateVersion } = await import(
    "../decision-trace/DecisionTraceSystem.js"
  );
  let signalMomentum: number | null = null;
  if (params.signalSnapshotId) {
    const [snap] = await db
      .select({ momentum: signalSnapshots.momentum })
      .from(signalSnapshots)
      .where(eq(signalSnapshots.id, params.signalSnapshotId))
      .limit(1);
    signalMomentum = snap?.momentum != null ? Number(snap.momentum) : null;
  }

  await traceControlOutput({
    blueprintId: params.blueprintId,
    userId: params.userId,
    packageId,
    condition: params.condition,
    signalMomentum,
    taskMin: rules.taskMin,
    taskMax: rules.taskMax,
    difficultyCap: rules.difficultyCap,
    stateVersion: await getBlueprintStateVersion(params.blueprintId),
  });

  return { packageId };
}

export function getBaseRules(condition: string): BaseConditionRules {
  const base = CONDITION_BASE_RULES[condition] ?? CONDITION_BASE_RULES.urgency;
  const contract = getConditionContract(condition);
  return {
    ...base,
    taskMin: contract.taskMin,
    taskMax: contract.taskMax,
    scalingAllowed: contract.scalingAllowed,
  };
}

export class ControlEngine {
  async resolve(blueprint: Blueprint, signals: SignalState): Promise<EnforcementPackage> {
    logger.info({ blueprintId: blueprint.id }, "[ControlEngine] resolve — use generateEnforcementPackage from workers");
    return {
      blueprintId: blueprint.id,
      userId: blueprint.userId,
      condition: signals.condition,
      allowedTaskTypes: ["action", "research", "habit"],
      blockedTaskTypes: [],
      maxDailyTasks: 3,
      focusDomain: blueprint.domain,
      overrideReason: null,
      generatedAt: new Date().toISOString(),
    };
  }
}