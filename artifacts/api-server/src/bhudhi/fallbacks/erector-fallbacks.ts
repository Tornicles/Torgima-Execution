/**
 * DOC B3 — deterministic Erector validation fallbacks when Bhudhi is unavailable.
 */
import type { ErectorFreeOutput, ErectorPaidOutput } from "../schemas/erector-schemas.js";

export const ERECTOR_FREE_FALLBACK: ErectorFreeOutput = {
  verdict: "adjust",
  validation_score: 50,
  top_strengths: ["Project has been defined", "Direction has been considered"],
  top_risks: ["Insufficient data to fully assess", "Manual review recommended"],
  primary_direction: "Gather more information before proceeding.",
  alternative_direction: "Consider a smaller proof-of-concept before full launch.",
  success_conditions: [
    "Complete the detailed intake for better assessment",
    "Validate demand with one paid pilot or pre-sale",
  ],
  failure_warnings: [
    "Launching without proof risks wasted effort",
    "Budget may be insufficient for stated scope",
  ],
  section_recommendation:
    "We need more information to give you a full recommendation. Please complete the detailed intake for better results.",
  section_health_score_breakdown:
    "Health score reflects limited quick-intake data only. A deeper assessment will produce a more reliable score.",
  section_market_reality:
    "Market conditions cannot be fully assessed from a five-question intake. Narrow your wedge and test demand locally first.",
  section_financial_assessment:
    "Financial feasibility requires clearer budget, timeline, and revenue assumptions before proceeding confidently.",
  section_execution_reality:
    "Execution readiness is unclear without deeper intake on resources, skills, and constraints.",
  section_strengths: "You have articulated a direction and started structured validation.",
  section_risk_flags: "Key risks include incomplete data, unvalidated demand, and scope uncertainty.",
  section_best_direction: "Gather more information and run one small validation experiment before scaling.",
  section_alternative_direction: "Pivot to a narrower offer that can be validated within 30 days.",
  section_success_conditions:
    "Complete detailed intake, prove willingness to pay, and document one measurable outcome.",
  section_failure_warnings:
    "Avoid scaling marketing or hiring before demand is proven with real customer evidence.",
};

export const ERECTOR_PAID_FALLBACK: ErectorPaidOutput = {
  ...ERECTOR_FREE_FALLBACK,
  goal_structured: {
    cleaned_goal: "Refine your stated goal into one measurable outcome with a clear customer.",
    measurable_outcome: "One paying customer or validated pre-sale within the stated timeframe.",
    feasibility_note: "Feasibility depends on proving demand before expanding scope.",
  },
  purpose_structured: {
    problem: "Customer problem not fully specified in fallback mode.",
    target_user: "Target user segment needs confirmation from intake data.",
    change: "Define the specific change your offer creates for one user.",
    value: "Articulate the concrete value delivered versus current alternatives.",
  },
  risk_flags: [
    "Incomplete intake data",
    "Unvalidated demand",
    "Resource constraints unclear",
  ],
  policy_rules: [
    "Do not scale spend before proof of demand",
    "Ship one verifiable outcome before adding scope",
    "Document blockers within 24 hours",
  ],
  winning_conditions: [
    "Paid pilot or pre-sale secured",
    "Repeatable acquisition channel identified",
    "Execution proof submitted weekly",
  ],
  failure_conditions: [
    "No customer conversations within 14 days",
    "Scope expands without new evidence",
    "Budget spent without measurable outcome",
  ],
  selected_path: "adjusted",
  section_strategy_recommendation:
    "Use an adjusted path: narrow the offer, prove demand, then expand only with evidence.",
  section_competitive_position:
    "Competitive position cannot be fully assessed without live research — start with a differentiated wedge.",
  section_90_day_action_map:
    "Days 1–14: customer discovery and offer test. Days 15–45: paid pilot. Days 46–90: repeat and refine.",
};

export const ERECTOR_STATE_EXPLAIN_FALLBACK = {
  headline: "Validation snapshot",
  explanation:
    "Your validation report is based on the information provided. Scores and direction are advisory — the rule engine owns final launch decisions.",
  nextActionReason: "Review the recommended direction and complete any missing intake before launching.",
  displayTone: "CALM" as const,
};

export const ERECTOR_FREE_VERDICT_EXPLAIN_FALLBACK = {
  user_facing_summary: "Project Intelligence Preview — your project shows early potential worth exploring further.",
  plain_language_reason:
    "This preview assessment uses only five intake answers. Market potential and resource fit were evaluated; demand proof was not scored because no customer or revenue data was provided. Upgrade for full validation with 40+ data points and archetype-specific intelligence.",
};
