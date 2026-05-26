import type { CultureProfile, HealthResult, OrgInput, StrategyResult } from "../contracts/types.js";

export class OrganizationHealthEngine {
  score(
    input: OrgInput,
    culture: CultureProfile,
    strategy: StrategyResult,
  ): HealthResult {
    const execution =
      (input.projects ?? []).length > 0
        ? Math.min(1, 0.5 + (input.projects ?? []).filter((p) => p.status === "done").length * 0.1)
        : 0.4;

    const cultureScore = (culture.trust + culture.cooperation + (1 - culture.burnout)) / 3;
    const strategyScore = strategy.strategyHealth;
    const risk = input.signals?.global === "danger" ? 0.8 : culture.burnout > 0.6 ? 0.65 : 0.25;
    const resilience = Math.min(1, culture.trust * 0.5 + strategyScore * 0.3 + (1 - risk) * 0.2);

    const raw =
      (execution * 0.25 + cultureScore * 0.25 + strategyScore * 0.25 + (1 - risk) * 0.15 + resilience * 0.1) *
      100;
    const score = Math.round(Math.min(100, Math.max(0, raw)));

    let action: HealthResult["action"] = "none";
    if (score < 40 || risk > 0.7) action = "escalate";
    else if (score < 60 || culture.burnout > 0.6) action = "recover";
    else if (score < 75) action = "adapt";

    return {
      score,
      execution,
      culture: cultureScore,
      strategy: strategyScore,
      risk,
      resilience,
      action,
    };
  }
}

export const organizationHealthEngine = new OrganizationHealthEngine();
