import type { EISIntelligence, FeasibilityAssessment, PISPrediction, RiskFlag } from "./validation-intelligence-types.js";

export function buildRiskMap(params: {
  eis: EISIntelligence;
  feasibility: FeasibilityAssessment;
  pis: PISPrediction;
}): RiskFlag[] {
  const flags: RiskFlag[] = [];
  let idx = 0;

  const add = (f: Omit<RiskFlag, "id">) => {
    flags.push({ id: `risk-${++idx}`, ...f });
  };

  if (params.eis.demand_signal.direction === "declining" && params.eis.demand_signal.strength === "weak") {
    add({
      title: "Weak declining demand",
      level: "critical",
      resolvable: true,
      prevention: "Pivot audience or offer",
      recovery: "Run 2-week demand proof sprint",
      source: "EIS",
    });
  }

  if (params.eis.saturation_level === "critical") {
    add({
      title: "Market saturation",
      level: "high",
      resolvable: true,
      prevention: "Differentiate positioning sharply",
      recovery: "Adopt alternative path with niche focus",
      source: "EIS",
    });
  }

  if (params.feasibility.score < 40) {
    add({
      title: "Low feasibility score",
      level: params.feasibility.score < 20 ? "critical" : "high",
      resolvable: true,
      prevention: "Reduce scope and add measurable milestones",
      recovery: "Select adjusted path with tighter scope",
      source: "PIS",
    });
  }

  for (const obstacle of params.pis.predicted_obstacles.slice(0, 3)) {
    add({
      title: obstacle.slice(0, 80),
      level: "medium",
      resolvable: true,
      prevention: "Address in first execution phase",
      recovery: "Add recovery project if triggered",
      source: "PIS",
    });
  }

  if (!flags.length) {
    add({
      title: "Execution consistency risk",
      level: "medium",
      resolvable: true,
      prevention: "Weekly proof ritual",
      recovery: "Scope reduction and recovery orders",
      source: "SIS",
    });
  }

  return flags;
}
