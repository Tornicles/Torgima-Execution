import type { ValidationExplanations } from "../../types/validationExplanations.js";

export type ExplanationContext = {
  idea_title: string;
  goal: string;
  verdict: string;
  reality_score: number;
  at_a_glance_json: string;
  trend_position: string;
  growth_rate: string;
  competitor_names_and_archetypes: string;
  pros_list: string;
  cons_list: string;
  opportunities_list: string;
  risks_list: string;
  selected_path_type: string;
  path_description: string;
  time_to_traction: string;
};

export function buildDeterministicExplanations(ctx: ExplanationContext): ValidationExplanations {
  return {
    reality_score:
      "This score reflects the weighted assessment of market demand, feasibility, timing, execution fit, and whether a real problem exists for this idea. Higher scores indicate stronger alignment across all dimensions.",
    final_verdict: `This verdict is based on your reality score of ${ctx.reality_score} and whether critical risks block launch. A ${ctx.verdict.toUpperCase()} outcome means the system weighed demand, competition, and execution fit for your stated goal.`,
    at_a_glance: {
      problem_exists:
        "This rating reflects what the research found for problem clarity relative to your idea, goal, and market context.",
      market_demand:
        "This rating reflects demand signals found for your market, including growth context where available.",
      competition_level:
        "This rating reflects how concentrated and active competition is in your space, based on the archetype scan.",
      execution_fit:
        "This rating reflects whether your stated context and commitment level match what this idea requires day to day.",
      feasibility:
        "This rating reflects whether your timeframe and goal can be approached with realistic build and proof steps.",
      timing:
        "This rating reflects trend position and whether entering now is favorable, neutral, or uphill.",
    },
    market_trends: `This trend position (${ctx.trend_position}) indicates where the market sits in its growth cycle and how that timing affects your ability to enter and compete.`,
    competitors_overview:
      "These three competitor archetypes represent dominant growth models in your market. Understanding how they scaled shows which patterns to replicate and which traps to avoid.",
    pros_cons:
      "These advantages and challenges are specific to your idea and market context. The balance between them informed the path recommendation and reality score.",
    opportunities:
      "These opportunities exist because of gaps or shifts in the current market that your idea is positioned to address.",
    risks:
      "These risks were identified based on your market context, execution requirements, and the competitive landscape.",
    path_current:
      "The current path keeps your original scope and tests whether demand appears before you add complexity.",
    path_adjusted: `The adjusted path (${ctx.selected_path_type}) is recommended because it trades scope for faster proof: ${ctx.path_description || "tighter milestones and clearer validation steps."}`,
    path_alternative:
      "The alternative path explores a pivot that could unlock a different customer or offer if the first proof stalls.",
    success_plan:
      "These milestones are sequenced so each proof unlocks the next stage without skipping demand or delivery validation.",
  };
}
