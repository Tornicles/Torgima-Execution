import type { HealthAction, TeamHealthResult, TeamInput } from "../contracts/types.js";

export class TeamHealth {
  measure(input: TeamInput, coordinationFriction: number): TeamHealthResult {
    const burnout =
      typeof input.identity?.burnout === "number"
        ? input.identity.burnout
        : typeof input.execution?.burnout === "number"
          ? input.execution.burnout
          : 0.2;
    const load =
      (input.members ?? []).length > 0
        ? (input.projects ?? []).length / (input.members ?? []).length / 3
        : 0.3;
    const trust =
      typeof input.identity?.trust === "number" ? input.identity.trust : 0.65;
    const momentum =
      typeof input.execution?.velocity === "number" ? input.execution.velocity : 0.55;
    const engagement = Math.max(0, 1 - burnout * 0.5 - coordinationFriction * 0.3);

    const raw =
      (1 - burnout) * 25 + (1 - Math.min(1, load)) * 20 + trust * 20 + momentum * 20 + engagement * 15;
    const score = Math.min(100, Math.max(0, Math.round(raw)));

    let action: HealthAction = "none";
    if (score < 35 || burnout > 0.8) action = "escalate";
    else if (score < 55 || load > 0.85) action = "recover";
    else if (score < 70) action = "adapt";

    return { score, burnout, load, trust, momentum, engagement, action };
  }
}

export const teamHealth = new TeamHealth();
