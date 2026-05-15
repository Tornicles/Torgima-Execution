/**
 * Deterministic team signal mathematics — aggregates member execution into team truth.
 */

export interface MemberSignalInput {
  userId: string;
  completionRate: number;
  momentum: number;
  proofReliability: number;
  activeOrderLoad: number;
}

export interface TeamSignalSnapshot {
  teamMomentum: number;
  teamConsistency: number;
  dependencyHealth: number;
  executionPressure: number;
  coordinationStability: number;
  bottleneckScore: number;
  overloadDetected: boolean;
  assignedConditionHint: string;
}

export function aggregateTeamSignals(members: MemberSignalInput[]): TeamSignalSnapshot {
  if (members.length === 0) {
    return {
      teamMomentum: 0,
      teamConsistency: 0,
      dependencyHealth: 0,
      executionPressure: 0,
      coordinationStability: 0,
      bottleneckScore: 0,
      overloadDetected: false,
      assignedConditionHint: "nothingness",
    };
  }

  const weights = members.map((m) => Math.max(0.1, m.proofReliability));
  const wSum = weights.reduce((a, b) => a + b, 0);

  const weighted = (vals: number[]) =>
    vals.reduce((s, v, i) => s + v * (weights[i]! / wSum), 0);

  const teamMomentum = weighted(members.map((m) => m.momentum));
  const teamConsistency = weighted(members.map((m) => m.completionRate));
  const executionPressure = weighted(members.map((m) => Math.min(m.activeOrderLoad / 5, 1)));
  const coordinationStability = 1 - stdDev(members.map((m) => m.completionRate));
  const dependencyHealth = teamConsistency * coordinationStability;
  const bottleneckScore = Math.max(...members.map((m) => m.activeOrderLoad)) / 5;
  const overloadDetected = executionPressure > 0.8 || bottleneckScore > 0.85;

  let assignedConditionHint = "stability";
  if (teamMomentum < 20 && teamConsistency < 0.3) assignedConditionHint = "nothingness";
  else if (overloadDetected) assignedConditionHint = "danger";
  else if (teamMomentum < 40) assignedConditionHint = "urgency";
  else if (teamMomentum > 75 && teamConsistency > 0.7) assignedConditionHint = "power";

  return {
    teamMomentum: round(teamMomentum),
    teamConsistency: round(teamConsistency),
    dependencyHealth: round(dependencyHealth),
    executionPressure: round(executionPressure),
    coordinationStability: round(coordinationStability),
    bottleneckScore: round(bottleneckScore),
    overloadDetected,
    assignedConditionHint,
  };
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
