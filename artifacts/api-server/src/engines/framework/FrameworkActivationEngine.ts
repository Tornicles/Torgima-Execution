import {
  db,
  signalSnapshots,
  blueprints,
  users,
  conditions,
  frameworkActivations,
  frameworkDecisions,
  frameworkSignalSnapshots,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

type FrameworkPhaseStatus = "active" | "limited" | "disabled";

const FRAMEWORK_PHASE1_STATUS: Record<string, FrameworkPhaseStatus> = {
  governance_risk:           "active",
  strategycore:              "active",
  synergyops:                "active",
  customervalue:             "active",
  clarity_catalyst:          "active",
  finmatrix:                 "limited",
  talentsync:                "limited",
  alignment_accountability:  "limited",
  omnigrowth:                "limited",
  adaptive_intelligence:     "limited",
  knowledgeflow:             "limited",
  decision_velocity:         "limited",
  regeneration_exit:         "limited",
  culture_dynamics:          "disabled",
};

const DOMAIN_FRAMEWORK_ROLES: Record<
  string,
  Partial<Record<string, "lead" | "veto" | "advise" | "blocked">>
> = {
  genesis: {
    governance_risk:  "veto",
    strategycore:     "lead",
    synergyops:       "blocked",
    customervalue:    "blocked",
    clarity_catalyst: "lead",
  },
  market: {
    governance_risk:  "veto",
    strategycore:     "advise",
    synergyops:       "blocked",
    customervalue:    "lead",
    clarity_catalyst: "advise",
  },
  delivery: {
    governance_risk:  "veto",
    strategycore:     "advise",
    synergyops:       "lead",
    customervalue:    "advise",
    clarity_catalyst: "blocked",
  },
  continuity: {
    governance_risk:  "lead",
    strategycore:     "lead",
    synergyops:       "advise",
    customervalue:    "blocked",
    clarity_catalyst: "blocked",
  },
  operations: {
    governance_risk:  "veto",
    strategycore:     "advise",
    synergyops:       "lead",
    customervalue:    "blocked",
    clarity_catalyst: "blocked",
  },
  people: {
    governance_risk:  "veto",
    strategycore:     "advise",
    synergyops:       "blocked",
    customervalue:    "lead",
    clarity_catalyst: "advise",
  },
  growth: {
    governance_risk:  "veto",
    strategycore:     "advise",
    synergyops:       "blocked",
    customervalue:    "lead",
    clarity_catalyst: "advise",
  },
};

const TIER_FRAMEWORK_CAP: Record<string, number> = {
  starter:  2,
  growth:   4,
  ultimate: 999,
};

type SignalRow = typeof signalSnapshots.$inferSelect;

export async function runFrameworkCycle(params: {
  blueprintId:      string;
  userId:           string;
  signalSnapshotId: string;
}): Promise<{ activationsCreated: number; decisionsCreated: number }> {
  const [signal] = await db
    .select()
    .from(signalSnapshots)
    .where(eq(signalSnapshots.id, params.signalSnapshotId))
    .limit(1);

  const [bpRow] = await db
    .select({
      domain: blueprints.current_domain,
      tier:   users.tier,
    })
    .from(blueprints)
    .innerJoin(users, eq(blueprints.user_id, users.id))
    .where(eq(blueprints.id, params.blueprintId))
    .limit(1);

  const [condition] = await db
    .select()
    .from(conditions)
    .where(
      and(eq(conditions.blueprint_id, params.blueprintId), eq(conditions.is_current, true)),
    )
    .limit(1);

  if (!signal || !bpRow) return { activationsCreated: 0, decisionsCreated: 0 };

  const domainKey = bpRow.domain ?? "delivery";
  const tierCap = TIER_FRAMEWORK_CAP[bpRow.tier] ?? 2;
  const conditionName = condition?.condition ?? "urgency";

  let activationsCreated = 0;
  let decisionsCreated = 0;
  let activeDecisionCount = 0;

  const allFrameworks = Object.entries(FRAMEWORK_PHASE1_STATUS).filter(
    ([, s]) => s !== "disabled",
  );

  for (const [frameworkName] of allFrameworks) {
    const signalState = deriveFrameworkSignalState(frameworkName, signal, conditionName);
    try {
      await db.insert(frameworkSignalSnapshots).values({
        blueprint_id:       params.blueprintId,
        signal_snapshot_id: params.signalSnapshotId,
        framework_name:     frameworkName as typeof frameworkSignalSnapshots.$inferInsert.framework_name,
        signal_state:       signalState,
        score:              deriveFrameworkScore(frameworkName, signal),
        confidence:
          signal.confidence === "high"
            ? 0.9
            : signal.confidence === "medium"
              ? 0.6
              : 0.3,
        evidence_json: {
          completion_rate: signal.completion_rate,
          weighted_score:  signal.weighted_score,
          trend:           signal.trend,
        },
      });
    } catch (err) {
      logger.debug({ err, frameworkName }, "[FrameworkEngine] snapshot insert skipped");
    }
  }

  const activeFrameworks = Object.entries(FRAMEWORK_PHASE1_STATUS).filter(
    ([, s]) => s === "active",
  );

  for (const [frameworkName] of activeFrameworks) {
    const roles = DOMAIN_FRAMEWORK_ROLES[domainKey] ?? DOMAIN_FRAMEWORK_ROLES["delivery"]!;
    const role = roles[frameworkName];
    if (role === "blocked") continue;

    if (!shouldFrameworkActivate(frameworkName, signal, conditionName)) continue;

    const [activation] = await db
      .insert(frameworkActivations)
      .values({
        blueprint_id:       params.blueprintId,
        user_id:            params.userId,
        signal_snapshot_id: params.signalSnapshotId,
        framework_name:
          frameworkName as typeof frameworkActivations.$inferInsert.framework_name,
        activation_level:  "diagnose",
        confidence:         0.75,
        reason:             `${frameworkName} activated — ${conditionName} condition in ${domainKey} domain`,
        trigger_condition:  conditionName,
        status:             "pending",
      })
      .returning();

    activationsCreated++;

    const decision =
      activeDecisionCount < tierCap
        ? buildFrameworkDecision(frameworkName, signal, conditionName, role ?? "advise")
        : null;

    if (decision && activation) {
      await db.insert(frameworkDecisions).values({
        activation_id:           activation.id,
        blueprint_id:            params.blueprintId,
        decision_type:           decision.type,
        target_layer:            decision.targetLayer,
        payload:                 decision.payload,
        requires_control_engine: true,
        status:                  "proposed",
      });
      decisionsCreated++;
      activeDecisionCount++;
    }
  }

  const limitedFrameworks = Object.entries(FRAMEWORK_PHASE1_STATUS).filter(
    ([, s]) => s === "limited",
  );

  for (const [frameworkName] of limitedFrameworks) {
    if (!shouldFrameworkActivate(frameworkName, signal, conditionName)) continue;

    try {
      await db.insert(frameworkActivations).values({
        blueprint_id:       params.blueprintId,
        user_id:            params.userId,
        signal_snapshot_id: params.signalSnapshotId,
        framework_name:
          frameworkName as typeof frameworkActivations.$inferInsert.framework_name,
        activation_level:  "monitor",
        confidence:         0.5,
        reason:             `${frameworkName} monitoring — limited in Phase 1`,
        trigger_condition:  conditionName,
        status:             "pending",
      });
      activationsCreated++;
    } catch (err) {
      logger.debug({ err, frameworkName }, "[FrameworkEngine] limited activation skipped");
    }
  }

  logger.info(
    {
      blueprintId: params.blueprintId,
      domain:      domainKey,
      tier:        bpRow.tier,
      activationsCreated,
      decisionsCreated,
    },
    "[FrameworkEngine] Cycle complete",
  );

  return { activationsCreated, decisionsCreated };
}

function shouldFrameworkActivate(
  frameworkName: string,
  signal:        SignalRow,
  condition:     string,
): boolean {
  if (frameworkName === "governance_risk") {
    return (
      ["danger", "nothingness", "urgency"].includes(condition) || signal.completion_rate < 0.4
    );
  }
  if (frameworkName === "strategycore") {
    return signal.completion_rate < 0.6 || ["nothingness", "urgency"].includes(condition);
  }
  if (frameworkName === "synergyops") {
    return signal.blocker_ratio > 0.2 || signal.completion_rate < 0.5;
  }
  if (frameworkName === "customervalue") {
    return signal.weighted_score < 6.0 || signal.trend === "declining";
  }
  if (frameworkName === "clarity_catalyst") {
    return (
      ["nothingness", "danger"].includes(condition) || signal.confidence === "insufficient_data"
    );
  }
  return signal.completion_rate < 0.7 || ["danger", "urgency"].includes(condition);
}

function deriveFrameworkSignalState(
  frameworkName: string,
  signal:        SignalRow,
  condition:     string,
): string {
  const rate = signal.completion_rate;
  if (frameworkName === "governance_risk") {
    return rate < 0.3 ? "high_risk" : rate < 0.6 ? "moderate_risk" : "low_risk";
  }
  if (frameworkName === "strategycore") {
    return signal.trend === "declining"
      ? "direction_drift"
      : signal.trend === "rising"
        ? "aligned"
        : "stable";
  }
  return condition === "danger"
    ? "critical"
    : condition === "urgency"
      ? "needs_attention"
      : "stable";
}

function deriveFrameworkScore(frameworkName: string, signal: SignalRow): number {
  void frameworkName;
  const base = signal.completion_rate * 5 + signal.weighted_score * 0.3;
  return Math.min(10, Math.max(0, base));
}

function buildFrameworkDecision(
  frameworkName: string,
  signal:        SignalRow,
  condition:     string,
  role:          string,
): { type: string; targetLayer: string; payload: Record<string, unknown> } | null {
  void role;
  if (frameworkName === "governance_risk" && ["danger", "urgency"].includes(condition)) {
    return {
      type:        "risk_restriction",
      targetLayer: "enforcement",
      payload:     { restrict_scaling: true, require_recovery: condition === "danger" },
    };
  }
  if (frameworkName === "strategycore" && signal.trend === "declining") {
    return {
      type:        "direction_review",
      targetLayer: "blueprint",
      payload:     { suggest_pivot_review: true, weeks_declining: 1 },
    };
  }
  if (frameworkName === "synergyops" && signal.blocker_ratio > 0.3) {
    return {
      type:        "workload_reduction",
      targetLayer: "enforcement",
      payload:     { max_concurrent_tasks: 1, priority: "dependency_resolution" },
    };
  }
  if (frameworkName === "customervalue" && signal.weighted_score < 5.0) {
    return {
      type:        "value_alignment_check",
      targetLayer: "task_generation",
      payload:     { require_value_task: true, minimum_score_threshold: 6 },
    };
  }
  if (frameworkName === "clarity_catalyst" && condition === "nothingness") {
    return {
      type:        "clarity_intervention",
      targetLayer: "onboarding",
      payload:     { trigger_goal_review: true, reason: "nothingness_condition" },
    };
  }
  return null;
}
