import { eq } from "drizzle-orm";
import {
  db,
  erectorArchetypeRulePacks,
  erectorThresholdMatrix,
  erectorVerdictDecisions,
  erectorVerdictRules,
} from "@workspace/db";
import type {
  RuleEvaluationContext,
  RuleEvaluationResult,
  VerdictEffect,
  VerdictRuleRow,
  DimensionScores,
} from "./types/verdict-types.js";
import { mapIntakeTierToMatrixTier } from "./ValidationScoringEngine.js";

type ThresholdJson = Record<string, unknown>;

function readThreshold(rule: VerdictRuleRow): ThresholdJson {
  return (rule.threshold_value ?? {}) as ThresholdJson;
}

function ruleAppliesToTier(rule: VerdictRuleRow, matrixTier: string): boolean {
  const tiers = rule.tier_applicability ?? [];
  return tiers.length === 0 || tiers.includes(matrixTier);
}

export function evaluateVerdictRule(
  rule: VerdictRuleRow,
  ctx: RuleEvaluationContext,
): boolean {
  const threshold = readThreshold(rule);
  const scores = ctx.scores;

  switch (rule.threshold_type) {
    case "score_lte": {
      const max = Number(threshold.max ?? threshold.tier_pivot ? ctx.thresholds.pivot_max_score : 100);
      if (rule.dimension === "market") return scores.market_viability_score <= max;
      if (rule.dimension === "global" && threshold.tier_pivot) {
        return scores.overall_validation_score <= ctx.thresholds.pivot_max_score;
      }
      if (rule.dimension === "simulation") {
        return scores.overall_validation_score <= max;
      }
      return scores.market_viability_score <= max;
    }
    case "score_gte": {
      const min = Number(threshold.min ?? 0);
      if (rule.dimension === "context" && rule.rule_id === "VR-040") {
        return scores.contradiction_score >= min;
      }
      if (rule.dimension === "global" && threshold.tier_proceed) {
        return scores.overall_validation_score >= ctx.thresholds.proceed_min_score;
      }
      if (rule.dimension === "demand") {
        return scores.demand_proof_class >= min;
      }
      return scores.overall_validation_score >= min;
    }
    case "combo": {
      if (threshold.tier_adjust) {
        return (
          scores.overall_validation_score >= ctx.thresholds.adjust_min_score &&
          scores.overall_validation_score < ctx.thresholds.proceed_min_score
        );
      }
      const min = Number(threshold.min ?? 0);
      const max = Number(threshold.max ?? 100);
      if (rule.dimension === "market") {
        return scores.market_viability_score >= min && scores.market_viability_score <= max;
      }
      return scores.overall_validation_score >= min && scores.overall_validation_score <= max;
    }
    case "class_gte": {
      if (threshold.archetype_min) {
        return scores.demand_proof_class < ctx.archetype_minimum_demand_class;
      }
      if (threshold.tier_min) {
        return scores.demand_proof_class < ctx.thresholds.demand_proof_min_class;
      }
      const min = Number(threshold.min ?? 1);
      return scores.demand_proof_class < min;
    }
    case "flag_present": {
      const flag = String(threshold.flag ?? "");
      if (flag === "blocked") return scores.feasibility_rating === "blocked";
      if (flag === "unlikely") return scores.feasibility_rating === "unlikely";
      if (flag === "missing_required_fields") return ctx.missing_critical_fields;
      if (flag === "framework_hard_veto") return ctx.framework_hard_veto;
      if (flag === "uncorrectable") return ctx.resource_goal_mismatch;
      return false;
    }
    default:
      return false;
  }
}

export function evaluateRulesFromCatalog(
  rules: VerdictRuleRow[],
  validationRunId: string,
  userId: string,
  ctx: RuleEvaluationContext,
): RuleEvaluationResult {
  const decisions_to_write: RuleEvaluationResult["decisions_to_write"] = [];
  const rules_fired: string[] = [];
  const hard_blockers: string[] = [];
  const soft_blockers: string[] = [];
  const soft_warnings: string[] = [];
  const verdict_effects: Array<{ rule_id: string; effect: VerdictEffect }> = [];

  for (const rule of rules) {
    if (!rule.active || !ruleAppliesToTier(rule, ctx.matrix_tier)) continue;
    const fired = evaluateVerdictRule(rule, ctx);
    if (!fired) continue;

    rules_fired.push(rule.rule_id);
    const effect = rule.verdict_effect as VerdictEffect;
    verdict_effects.push({ rule_id: rule.rule_id, effect });

    if (rule.severity === "HARD_BLOCKER") hard_blockers.push(rule.rule_id);
    else if (rule.severity === "SOFT_BLOCKER") soft_blockers.push(rule.rule_id);
    else if (rule.severity === "WARNING") soft_warnings.push(rule.rule_id);

    decisions_to_write.push({
      validation_run_id: validationRunId,
      user_id: userId,
      rule_id: rule.rule_id,
      dimension: rule.dimension,
      input_value: {
        scores: ctx.scores,
        archetype_id: ctx.archetype_id,
        missing_critical_fields: ctx.missing_critical_fields,
      },
      threshold_compared: readThreshold(rule),
      severity: rule.severity,
      verdict_effect: rule.verdict_effect,
      fired: true,
      rule_version: rule.rule_version,
    });
  }

  return {
    rules_evaluated: rules.length,
    rules_fired,
    hard_blockers,
    soft_blockers,
    soft_warnings,
    verdict_effects,
    decisions_to_write,
    framework_hard_veto: ctx.framework_hard_veto,
  };
}

export async function loadRuleEvaluationContext(
  intakeTier: string,
  archetypeId: string,
  scores: RuleEvaluationContext["scores"],
  profileFlags: {
    missing_fields: string[];
    contradiction_flags: string[];
    regulatory_flags: string[];
  },
): Promise<RuleEvaluationContext> {
  const matrixTier = mapIntakeTierToMatrixTier(intakeTier);

  const [thresholdRow] = await db
    .select()
    .from(erectorThresholdMatrix)
    .where(eq(erectorThresholdMatrix.tier, matrixTier))
    .limit(1);

  const [archetypePack] = await db
    .select()
    .from(erectorArchetypeRulePacks)
    .where(eq(erectorArchetypeRulePacks.archetype_id, archetypeId))
    .limit(1);

  const framework_hard_veto = profileFlags.regulatory_flags.length > 0;

  const missing_critical_fields = profileFlags.missing_fields.length > 0;
  const resource_goal_mismatch = profileFlags.contradiction_flags.includes("RESOURCE_TIMELINE_MISMATCH");

  if (!thresholdRow) {
    throw new Error(`Missing erector_threshold_matrix row for tier ${matrixTier}`);
  }

  return {
    scores,
    thresholds: {
      tier: matrixTier,
      proceed_min_score: thresholdRow.proceed_min_score,
      adjust_min_score: thresholdRow.adjust_min_score,
      pivot_max_score: thresholdRow.pivot_max_score,
      market_weight: Number(thresholdRow.market_weight),
      demand_weight: Number(thresholdRow.demand_weight),
      feasibility_weight: Number(thresholdRow.feasibility_weight),
      context_weight: Number(thresholdRow.context_weight),
      demand_proof_min_class: thresholdRow.demand_proof_min_class,
    },
    archetype_id: archetypeId,
    archetype_minimum_demand_class: archetypePack?.minimum_demand_proof_class ?? 3,
    missing_critical_fields,
    framework_hard_veto,
    resource_goal_mismatch,
    matrix_tier: matrixTier,
  };
}

const FREE_TIER_PREVIEW_NOTE =
  "This is a preview assessment based on 5 data points. Full analysis uses 40+ data points and applies archetype-specific intelligence.";

/** Gap Fix 1 — simplified free-tier rule evaluation (preview only). */
export function evaluateFreeTierRules(
  validationRunId: string,
  userId: string,
  scores: DimensionScores,
): RuleEvaluationResult {
  const hard_blockers: string[] =
    scores.feasibility_rating === "blocked" ? ["BUDGET_TOO_LOW"] : [];
  const soft_warnings: string[] = [];
  if (scores.market_viability_score <= 25) {
    soft_warnings.push("INDUSTRY_MISSING");
  }
  if (scores.feasibility_score < 50) {
    soft_warnings.push("LOW_FEASIBILITY");
  }

  const free_tier_verdict =
    scores.overall_validation_score >= 50
      ? "PROCEED"
      : scores.overall_validation_score >= 30
        ? "ADJUST"
        : "PIVOT";

  return {
    rules_evaluated: 1,
    rules_fired: ["VR-FREE-01"],
    hard_blockers,
    soft_blockers: [],
    soft_warnings,
    verdict_effects: [{ rule_id: "VR-FREE-01", effect: "NONE" }],
    decisions_to_write: [
      {
        validation_run_id: validationRunId,
        user_id: userId,
        rule_id: "VR-FREE-01",
        dimension: "global",
        input_value: { scores, tier: "free" },
        threshold_compared: { proceed_preview: 50, adjust_preview: 30 },
        severity: "INFO",
        verdict_effect: "NONE",
        fired: true,
        rule_version: "gap-fix-1",
      },
    ],
    framework_hard_veto: false,
    free_tier_verdict,
    free_tier_note: FREE_TIER_PREVIEW_NOTE,
    upgrade_required_for_full_validation: true,
  };
}

export async function evaluateRules(
  validationRunId: string,
  userId: string,
  _profileId: string,
  scores: RuleEvaluationContext["scores"],
  intakeTier: string,
  archetypeId: string,
  profileFlags: {
    missing_fields: string[];
    contradiction_flags: string[];
    regulatory_flags: string[];
  },
  rulePack?: { minimum_demand_proof_class: number } | null,
): Promise<RuleEvaluationResult> {
  if (intakeTier === "free") {
    const result = evaluateFreeTierRules(validationRunId, userId, scores);
    if (result.decisions_to_write.length > 0) {
      await db.insert(erectorVerdictDecisions).values(result.decisions_to_write);
    }
    return result;
  }

  const ctx = await loadRuleEvaluationContext(intakeTier, archetypeId, scores, profileFlags);
  if (rulePack?.minimum_demand_proof_class != null) {
    ctx.archetype_minimum_demand_class = rulePack.minimum_demand_proof_class;
  }

  const rules = await db
    .select()
    .from(erectorVerdictRules)
    .where(eq(erectorVerdictRules.active, true));

  const result = evaluateRulesFromCatalog(rules, validationRunId, userId, ctx);

  if (result.decisions_to_write.length > 0) {
    await db.insert(erectorVerdictDecisions).values(result.decisions_to_write);
  }

  return result;
}
