/**
 * DOC B3 — Erector validation Bhudhi output data schemas.
 */
import { z } from "zod";

/** Schema for FREE validation output (5-question quick assessment). */
export const ErectorFreeOutputSchema = z.object({
  verdict: z.enum(["proceed", "adjust", "pivot"]),
  validation_score: z.number().min(0).max(100),
  top_strengths: z.array(z.string()).max(3),
  top_risks: z.array(z.string()).max(5),
  primary_direction: z.string(),
  alternative_direction: z.string().optional(),
  success_conditions: z.array(z.string()).max(4),
  failure_warnings: z.array(z.string()).max(4),
  section_recommendation: z.string(),
  section_health_score_breakdown: z.string(),
  section_market_reality: z.string(),
  section_financial_assessment: z.string(),
  section_execution_reality: z.string(),
  section_strengths: z.string(),
  section_risk_flags: z.string(),
  section_best_direction: z.string(),
  section_alternative_direction: z.string(),
  section_success_conditions: z.string(),
  section_failure_warnings: z.string(),
});

/** Schema for PAID validation output (8-section deep assessment). */
export const ErectorPaidOutputSchema = ErectorFreeOutputSchema.extend({
  goal_structured: z.object({
    cleaned_goal: z.string(),
    measurable_outcome: z.string(),
    feasibility_note: z.string().optional(),
  }),
  purpose_structured: z.object({
    problem: z.string(),
    target_user: z.string(),
    change: z.string(),
    value: z.string(),
  }),
  risk_flags: z.array(z.string()),
  policy_rules: z.array(z.string()),
  winning_conditions: z.array(z.string()),
  failure_conditions: z.array(z.string()),
  selected_path: z.enum(["current", "adjusted", "alternative"]),
  section_strategy_recommendation: z.string(),
  section_competitive_position: z.string(),
  section_90_day_action_map: z.string(),
});

export type ErectorFreeOutput = z.infer<typeof ErectorFreeOutputSchema>;
export type ErectorPaidOutput = z.infer<typeof ErectorPaidOutputSchema>;
