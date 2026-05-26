import type { AlignmentResult, TeamInput } from "../contracts/types.js";

export class AlignmentEngine {
  track(input: TeamInput, teamIdentityHealth: number): AlignmentResult {
    const goal =
      typeof input.organization?.alignment === "number"
        ? input.organization.alignment
        : typeof input.organization?.vision === "string"
          ? 0.7
          : 0.55;
    const strategy =
      typeof input.organization?.strategyScore === "number"
        ? input.organization.strategyScore
        : 0.6;
    const identityAlign = teamIdentityHealth;

    const alignment = (goal + strategy + identityAlign) / 3;
    const conflicts: string[] = [];
    if (goal < 0.5) conflicts.push("goal misalignment");
    if (input.execution?.dissent === true) conflicts.push("visible disagreement on direction");

    const recommendations: string[] = [];
    if (conflicts.length > 0) recommendations.push("Run consensus before next execution");
    if (alignment < 0.6) recommendations.push("Alignment beats speed — reconcile strategy first");
    if (recommendations.length === 0) recommendations.push("Team aligned — proceed with shared execution");

    return { alignment, conflicts, recommendations };
  }
}

export const alignmentEngine = new AlignmentEngine();
