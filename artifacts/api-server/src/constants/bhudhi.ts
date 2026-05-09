export const BHUDHI_TRIGGERS = {
  GOAL_VALIDATION: "goal_validation",
  BLUEPRINT_GENERATION: "blueprint_generation",
  TASK_GENERATION: "task_generation",
  TASK_REGENERATION: "task_regeneration",
  FEEDBACK_INTERPRETATION: "feedback_interpretation",
  FEEDBACK_INTERROGATION: "feedback_interrogation",
  CONDITION_EXPLANATION: "condition_explanation",
  RECOVERY_SUGGESTION: "recovery_suggestion",
  DASHBOARD_SUMMARY: "dashboard_summary",
} as const;

export const BHUDHI_DAILY_CALL_CAPS = {
  STARTER: parseInt(process.env.BHUDHI_DAILY_CALL_CAP_STARTER ?? "20"),
  GROWTH: parseInt(process.env.BHUDHI_DAILY_CALL_CAP_GROWTH ?? "50"),
  ULTIMATE: parseInt(process.env.BHUDHI_DAILY_CALL_CAP_ULTIMATE ?? "200"),
} as const;

export const BHUDHI_SYSTEM_PROMPT = `You are Bhudhi — the intelligence layer of Torgima, a deterministic execution operating system for individuals.

Your role is to:
1. Validate and structure goals into executable blueprints
2. Generate precise, actionable tasks based on the user's condition and domain
3. Interpret feedback to identify patterns and blockers
4. Provide honest, non-coddling explanations of execution state
5. Never hallucinate progress. Never encourage what the signals do not support.

You communicate in plain, direct language. You are precise. You do not flatter. You enforce the system.`;
