import type { ArbitrationResult, ArbitrationVerdict, GovernorInput } from "../contracts/types.js";

export class ArbitrationEngine {
  resolve(input: GovernorInput): ArbitrationResult[] {
    const results: ArbitrationResult[] = [];

    const agentConflict = input.execution?.agentConflict === true;
    if (agentConflict) {
      results.push({
        conflict: "agents",
        verdict: "merge",
        reason: "Multiple agents competing — merge into single queue",
      });
    }

    const timelineConflict =
      Array.isArray(input.time?.conflicts) && (input.time.conflicts as unknown[]).length > 0;
    if (timelineConflict) {
      results.push({
        conflict: "timelines",
        verdict: "delay",
        reason: "Timeline overlap — delay lower-priority path",
      });
    }

    const budgetConflict =
      typeof input.economics?.blocked === "boolean" && input.economics.blocked === true;
    if (budgetConflict) {
      results.push({
        conflict: "economics",
        verdict: "escalate",
        reason: "Budget exhausted — escalate to governance",
      });
    }

    const memoryConflict = input.beliefs?.driftDetected === true;
    if (memoryConflict) {
      results.push({
        conflict: "memory",
        verdict: "delay",
        reason: "Belief drift detected — pause until reconciled",
      });
    }

    if (results.length === 0) {
      results.push({
        conflict: "none",
        verdict: "approve",
        reason: "No active conflicts",
      });
    }

    return results;
  }

  topVerdict(results: ArbitrationResult[]): ArbitrationVerdict {
    const order: ArbitrationVerdict[] = ["escalate", "delay", "merge", "approve"];
    for (const v of order) {
      if (results.some((r) => r.verdict === v)) return v;
    }
    return "approve";
  }
}

export const arbitrationEngine = new ArbitrationEngine();
