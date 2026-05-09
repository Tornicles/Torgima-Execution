import type { BhudhiTrigger } from "../types/bhudhi.js";

/**
 * FallbackLibrary — Provides deterministic fallback responses when Bhudhi is unavailable.
 * Ensures the system degrades gracefully, not silently.
 * TODO (Prompt 3): Populate per-trigger fallbacks
 */
export class FallbackLibrary {
  getFallback(trigger: BhudhiTrigger): Record<string, unknown> {
    const fallbacks: Partial<Record<BhudhiTrigger, Record<string, unknown>>> = {
      goal_validation: {
        valid: true,
        score: 50,
        feedback: "Goal accepted. Detailed validation temporarily unavailable.",
        suggestedDomain: null,
        refinedGoal: null,
        issues: [],
      },
      dashboard_summary: {
        summary: "Your execution data is being processed.",
        recommendation: "Complete your next active task.",
      },
    };
    return fallbacks[trigger] ?? {};
  }
}
