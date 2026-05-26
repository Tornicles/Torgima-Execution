import type { GovernorInput, PriorityEntry, PriorityLevel, PriorityMap } from "../contracts/types.js";

function levelFromScore(score: number): PriorityLevel {
  if (score >= 0.9) return "CRITICAL";
  if (score >= 0.75) return "HIGH";
  if (score >= 0.5) return "NORMAL";
  if (score >= 0.3) return "LOW";
  return "BACKGROUND";
}

export class PriorityEngine {
  score(input: GovernorInput, subsystem: string): { priority: PriorityLevel; score: number; reason: string } {
    const impact = typeof input.decisions?.impact === "number" ? input.decisions.impact : 0.5;
    const urgency =
      typeof input.time?.urgency === "number"
        ? input.time.urgency
        : typeof input.execution?.urgency === "number"
          ? input.execution.urgency
          : 0.4;
    const risk =
      typeof input.identity?.burnout === "number"
        ? input.identity.burnout
        : typeof input.world?.risk === "number"
          ? input.world.risk
          : 0.3;
    const opportunity = typeof input.time?.opportunityScore === "number" ? input.time.opportunityScore : 0.5;
    const capacity =
      typeof input.organization?.utilization === "number"
        ? 1 - Math.min(1, input.organization.utilization)
        : 0.6;

    const subsystemBoost =
      subsystem === "execution" ? 0.1 : subsystem === "governance" ? 0.08 : 0;

    const score = Math.min(
      1,
      impact * 0.25 + urgency * 0.25 + risk * 0.2 + (opportunity / 100) * 0.15 + capacity * 0.15 + subsystemBoost,
    );

    const priority = levelFromScore(score);
    const reason = `impact ${Math.round(impact * 100)}%, urgency ${Math.round(urgency * 100)}%, risk ${Math.round(risk * 100)}%`;

    return { priority, score, reason };
  }

  buildMap(input: GovernorInput): PriorityMap {
    const subsystems =
      input.subsystems ??
      ["memory", "simulation", "agents", "economics", "execution", "dashboard", "governance"];

    const entries: PriorityEntry[] = subsystems.map((s) => {
      const scored = this.score(input, s);
      return { subsystem: s, ...scored };
    });

    entries.sort((a, b) => b.score - a.score);
    const topPriority = entries[0] ?? {
      subsystem: "execution",
      priority: "NORMAL" as PriorityLevel,
      score: 0.5,
      reason: "Default priority",
    };

    return { entries, topPriority };
  }
}

export const priorityEngine = new PriorityEngine();
