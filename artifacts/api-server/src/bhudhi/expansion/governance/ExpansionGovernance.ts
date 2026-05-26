import type { BenchmarkResult, DiscoveredCapability, ExpansionInput, ExpansionLevel } from "../contracts/types.js";

export class ExpansionGovernance {
  requireApproval(
    input: ExpansionInput,
    candidates: DiscoveredCapability[],
    benchmark: BenchmarkResult | null,
    level: ExpansionLevel = "LOCAL",
  ): { approval: boolean; reason: string; level: ExpansionLevel } {
    if (level === "LOCKED") {
      return { approval: false, reason: "Capability level LOCKED — cannot expand", level };
    }

    if (!benchmark) {
      return { approval: false, reason: "No benchmark — no promotion", level };
    }

    if (benchmark.confidence < 0.4) {
      return { approval: false, reason: "Benchmark confidence too low", level };
    }

    if (level === "GLOBAL" && !input.governanceApproved) {
      return { approval: false, reason: "GLOBAL expansion requires governance approval", level };
    }

    if (candidates.some((c) => c.score > 0.9) && !input.governanceApproved) {
      return { approval: false, reason: "High-score capability requires explicit governance approval", level };
    }

    const needsAudit = level === "SYSTEM" || level === "GLOBAL";
    if (needsAudit && !input.governanceApproved) {
      return { approval: false, reason: `${level} expansion requires audit and governance sign-off`, level };
    }

    return {
      approval: input.governanceApproved !== false && benchmark.gain > 0,
      reason: "Governance checks passed — capability may persist",
      level,
    };
  }

  resolveLevel(candidates: DiscoveredCapability[]): ExpansionLevel {
    const max = candidates.reduce((m, c) => Math.max(m, c.score), 0);
    if (max > 0.85) return "SYSTEM";
    if (max > 0.95) return "GLOBAL";
    return "LOCAL";
  }

  /** Human approval gate — cannot be bypassed for high-risk capabilities. */
  makeDecision(approved: boolean, riskLevel: "low" | "medium" | "high" | "critical"): {
    status: "approved" | "rejected" | "pending_approval";
    requiresHumanReview: boolean;
    reason: string;
  } {
    if (riskLevel === "critical") {
      return {
        status: approved ? "approved" : "rejected",
        requiresHumanReview: true,
        reason: "Critical risk — human decision recorded",
      };
    }
    if (!approved) {
      return {
        status: "rejected",
        requiresHumanReview: false,
        reason: "Capability rejected by governance",
      };
    }
    return {
      status: "approved",
      requiresHumanReview: riskLevel === "high",
      reason: "Approved — may promote after sandbox validation",
    };
  }

  /** Auto-approve is disabled by default (bounded self-improvement, not AGI). */
  canAutoApprove(_riskLevel: string, _estimatedValue: number): boolean {
    return false;
  }

  checkLimits(activeCount: number, testingCount: number): { canExpand: boolean; issues: string[] } {
    const issues: string[] = [];
    if (activeCount >= 1000) issues.push("Max capabilities reached (1000)");
    if (testingCount >= 3) issues.push("Too many parallel expansions in testing");
    return { canExpand: issues.length === 0, issues };
  }
}

export const expansionGovernance = new ExpansionGovernance();
