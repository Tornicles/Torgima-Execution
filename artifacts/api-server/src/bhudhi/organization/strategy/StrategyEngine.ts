import type { OrgInput, StrategyResult } from "../contracts/types.js";

export class StrategyEngine {
  map(input: OrgInput): StrategyResult {
    const hasVision = Boolean(input.strategy?.vision || input.strategy?.goals);
    const hasPriorities = Boolean(input.strategy?.priorities);
    const projectCount = (input.projects ?? []).length;

    const alignment = hasVision
      ? Math.min(1, 0.5 + (hasPriorities ? 0.2 : 0) + projectCount * 0.05)
      : 0.25;

    const strategyHealth = hasVision && hasPriorities ? 0.8 : hasVision ? 0.55 : 0.3;

    const recommendations: string[] = [];
    if (!hasVision) recommendations.push("Define organizational vision before execution");
    if (!hasPriorities) recommendations.push("Set explicit priorities across initiatives");
    if (projectCount === 0) recommendations.push("Map initiatives to projects");

    return {
      alignment,
      strategyHealth,
      recommendations,
      hasVision,
    };
  }

  /** Execution without strategy is blocked. */
  blocksExecution(input: OrgInput): boolean {
    const s = this.map(input);
    return !s.hasVision && (input.projects ?? []).length > 0;
  }
}

export const strategyEngine = new StrategyEngine();
