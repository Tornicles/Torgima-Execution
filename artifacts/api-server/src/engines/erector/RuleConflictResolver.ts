import type {
  DimensionScores,
  ErectorVerdict,
  FinalVerdictDecision,
  RuleEvaluationResult,
  TierThresholds,
  VerdictEffect,
} from "./types/verdict-types.js";

function highestEffect(effects: VerdictEffect[]): VerdictEffect | null {
  if (effects.includes("PIVOT")) return "PIVOT";
  if (effects.includes("ADJUST")) return "ADJUST";
  if (effects.includes("NONE")) return "NONE";
  return null;
}

export function resolveConflicts(
  ruleResults: RuleEvaluationResult,
  scores: DimensionScores,
  thresholds: TierThresholds,
): FinalVerdictDecision {
  const reasoning: string[] = [];
  const correction_fields: string[] = [];

  if (ruleResults.framework_hard_veto || ruleResults.rules_fired.includes("VR-060")) {
    reasoning.push("A framework hard veto requires a direction change.");
    return {
      verdict: "PIVOT",
      recommended_path: "alternative",
      reasoning,
      correction_fields: ["regulatory_flags", "compliance"],
      requires_correction: true,
      hard_blockers: ruleResults.hard_blockers,
      soft_warnings: ruleResults.soft_warnings,
    };
  }

  if (ruleResults.rules_fired.includes("VR-040") || scores.contradiction_score > 70) {
    reasoning.push("Critical contradictions between your goal and context require a pivot.");
    return {
      verdict: "PIVOT",
      recommended_path: "alternative",
      reasoning,
      correction_fields: ["timeline_launch", "hours_per_week", "budget_range"],
      requires_correction: true,
      hard_blockers: ruleResults.hard_blockers,
      soft_warnings: ruleResults.soft_warnings,
    };
  }

  const hardPivotRules = ruleResults.verdict_effects.filter(
    (e) => ruleResults.hard_blockers.includes(e.rule_id) && e.effect === "PIVOT",
  );
  if (hardPivotRules.length > 0) {
    reasoning.push(`Hard blockers fired: ${hardPivotRules.map((r) => r.rule_id).join(", ")}`);
    if (ruleResults.rules_fired.includes("VR-020")) {
      correction_fields.push("feasibility");
    }
    return {
      verdict: "PIVOT",
      recommended_path: "alternative",
      reasoning,
      correction_fields,
      requires_correction: true,
      hard_blockers: ruleResults.hard_blockers,
      soft_warnings: ruleResults.soft_warnings,
    };
  }

  const hardAdjust = ruleResults.verdict_effects.filter(
    (e) => ruleResults.hard_blockers.includes(e.rule_id) && e.effect === "ADJUST",
  );
  const softAdjust = ruleResults.verdict_effects.filter(
    (e) => ruleResults.soft_blockers.includes(e.rule_id) && e.effect === "ADJUST",
  );

  if (hardAdjust.length > 0 || softAdjust.length > 0) {
    reasoning.push("Rule blockers require plan adjustments before proceeding.");
    if (ruleResults.rules_fired.includes("VR-010")) correction_fields.push("demand_proof");
    if (ruleResults.rules_fired.includes("VR-050")) correction_fields.push("required_fields");
    return {
      verdict: "ADJUST",
      recommended_path: "adjusted",
      reasoning,
      correction_fields,
      requires_correction: true,
      hard_blockers: ruleResults.hard_blockers,
      soft_warnings: ruleResults.soft_warnings,
    };
  }

  const blockerEffect = highestEffect(
    ruleResults.verdict_effects
      .filter((e) => e.effect !== "NONE")
      .map((e) => e.effect),
  );

  if (blockerEffect === "PIVOT") {
    reasoning.push("Conflicting rule effects resolved to PIVOT.");
    return {
      verdict: "PIVOT",
      recommended_path: "alternative",
      reasoning,
      correction_fields,
      requires_correction: true,
      hard_blockers: ruleResults.hard_blockers,
      soft_warnings: ruleResults.soft_warnings,
    };
  }

  if (blockerEffect === "ADJUST") {
    reasoning.push("Conflicting rule effects resolved to ADJUST.");
    return {
      verdict: "ADJUST",
      recommended_path: "adjusted",
      reasoning,
      correction_fields,
      requires_correction: true,
      hard_blockers: ruleResults.hard_blockers,
      soft_warnings: ruleResults.soft_warnings,
    };
  }

  if (scores.overall_validation_score >= thresholds.proceed_min_score) {
    reasoning.push(`Overall score ${scores.overall_validation_score} meets proceed threshold ${thresholds.proceed_min_score}.`);
    return {
      verdict: "PROCEED",
      recommended_path: "current",
      reasoning,
      correction_fields: [],
      requires_correction: false,
      hard_blockers: ruleResults.hard_blockers,
      soft_warnings: ruleResults.soft_warnings,
    };
  }

  if (scores.overall_validation_score >= thresholds.adjust_min_score) {
    reasoning.push(`Overall score ${scores.overall_validation_score} is in the adjust band.`);
    return {
      verdict: "ADJUST",
      recommended_path: "adjusted",
      reasoning,
      correction_fields: ["scope", "timeline_launch"],
      requires_correction: true,
      hard_blockers: ruleResults.hard_blockers,
      soft_warnings: ruleResults.soft_warnings,
    };
  }

  reasoning.push(`Overall score ${scores.overall_validation_score} is below pivot threshold.`);
  return {
    verdict: "PIVOT",
    recommended_path: "alternative",
    reasoning,
    correction_fields: ["what_building", "target_who", "budget_range"],
    requires_correction: true,
    hard_blockers: ruleResults.hard_blockers,
    soft_warnings: ruleResults.soft_warnings,
  };
}

const FREE_TIER_PREVIEW_NOTE =
  "This is a preview assessment based on 5 data points. Full analysis uses 40+ data points and applies archetype-specific intelligence.";

export function freeTierPreviewLabel(verdict: ErectorVerdict): string {
  if (verdict === "PROCEED") return "Good Potential";
  if (verdict === "ADJUST") return "Some Gaps to Address";
  return "Key Issues Worth Reviewing";
}

/** Gap Fix 1 — lower preview thresholds: PROCEED >= 50, ADJUST >= 30, else PIVOT. */
export function resolveFreeTierConflicts(
  ruleResults: RuleEvaluationResult,
  scores: DimensionScores,
): FinalVerdictDecision {
  const verdict =
    ruleResults.free_tier_verdict ??
    (scores.overall_validation_score >= 50
      ? "PROCEED"
      : scores.overall_validation_score >= 30
        ? "ADJUST"
        : "PIVOT");

  const reasoning = [
    ruleResults.free_tier_note ?? FREE_TIER_PREVIEW_NOTE,
    `Preview overall score: ${scores.overall_validation_score}.`,
  ];

  if (scores.market_viability_score <= 25) {
    reasoning.push("Industry was not provided — market potential is uncertain.");
  }
  if (scores.feasibility_score < 50) {
    reasoning.push("Resource fit may be tight at the stated budget and timeline.");
  }
  if (ruleResults.hard_blockers.includes("BUDGET_TOO_LOW")) {
    reasoning.push("Budget may be too low to support the stated timeline.");
  }

  return {
    verdict,
    recommended_path:
      verdict === "PROCEED" ? "current" : verdict === "ADJUST" ? "adjusted" : "alternative",
    reasoning,
    correction_fields: verdict === "PROCEED" ? [] : ["budget_range", "timeline_launch"],
    requires_correction: verdict !== "PROCEED",
    hard_blockers: ruleResults.hard_blockers,
    soft_warnings: ruleResults.soft_warnings,
    is_free_tier_preview: true,
    preview_verdict_label: freeTierPreviewLabel(verdict),
    upgrade_required_for_full_validation: true,
  };
}
