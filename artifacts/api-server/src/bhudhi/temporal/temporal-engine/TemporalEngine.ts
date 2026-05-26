import { randomUUID } from "node:crypto";
import { temporalPolicy } from "../policy/TemporalPolicy.js";
import { chronologyEngine } from "../chronology/ChronologyEngine.js";
import { opportunityEngine } from "../opportunity/OpportunityEngine.js";
import { momentumEngine } from "../momentum/MomentumEngine.js";
import { executionWindows } from "../windows/ExecutionWindows.js";
import { timelineEngine } from "../timeline/TimelineEngine.js";
import { branchingEngine } from "../branching/BranchingEngine.js";
import { schedulingEngine } from "../scheduling/SchedulingEngine.js";
import { temporalForecast } from "../forecasting/TemporalForecast.js";
import { temporalMemory } from "../temporal-memory/TemporalMemory.js";
import { persistTemporalSession, listTemporalHistory } from "../temporalData.js";
import type { TemporalInput, TemporalOutput } from "../contracts/types.js";
import { logger } from "../../../lib/logger.js";

/**
 * BTIE — temporal cognition. Bhudhi executes at the right time.
 */
export class TemporalEngine {
  async analyze(input: TemporalInput): Promise<TemporalOutput> {
    const sessionId = randomUUID();
    const policy = temporalPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Temporal policy violation: ${policy.violations.join("; ")}`);
    }

    const chronology = chronologyEngine.sequence(input);
    const opportunity = opportunityEngine.detect(input);
    const momentum = momentumEngine.track(input);
    const windows = executionWindows.generate(input, momentum.risk);
    const timeline = timelineEngine.build(input);
    const branch = branchingEngine.evaluate(input);
    const schedule = schedulingEngine.schedule(input);
    const forecast = temporalForecast.forecast(input, momentum.momentum);

    const urgency = Math.min(
      1,
      opportunity.score / 100 * 0.4 + momentum.risk * 0.3 + (1 - windows.primary.successProbability) * 0.2,
    );

    let recommendation = opportunity.recommendedAction;
    if (windows.primary.window === "best") {
      recommendation = `Execute now — ${windows.primary.label} (${Math.round(windows.primary.successProbability * 100)}% success)`;
    } else if (windows.primary.window === "avoid") {
      recommendation = `Defer — ${windows.primary.label}. ${branch.recommendedPath}`;
    } else {
      recommendation = `${opportunity.recommendedAction}. ${branch.recommendedPath}`;
    }

    const output: TemporalOutput = {
      sessionId,
      timeState: {
        phase: "present",
        now: new Date().toISOString(),
        horizonDays: 90,
      },
      window: windows.primary,
      recommendation,
      urgency,
      momentum,
      chronology,
      branch,
      forecast,
    };

    temporalMemory.store(input.blueprintId, output);

    try {
      await persistTemporalSession(output, {
        blueprintId: input.blueprintId,
        goal: input.goal,
      });
      void schedule;
      void timeline;
    } catch (err) {
      logger.warn({ err, sessionId }, "[TemporalEngine] persist skipped");
    }

    return output;
  }

  formatTemporalContext(output: TemporalOutput): string {
    return [
      `Time: ${output.timeState.phase} (${output.timeState.now.slice(0, 10)})`,
      `Window: ${output.window.window} — ${output.window.label}`,
      `Urgency: ${Math.round(output.urgency * 100)}%`,
      output.momentum ? `Momentum: ${output.momentum.trajectory}` : "",
      `Why now: ${output.recommendation.slice(0, 120)}`,
      output.window.expiresAt ? `Expires: ${output.window.expiresAt.slice(0, 10)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async window(input: TemporalInput) {
    const full = await this.analyze(input);
    return full.window;
  }

  async forecast(input: TemporalInput) {
    const cached = temporalMemory.get(input.blueprintId);
    if (cached?.forecast) return cached.forecast;
    const full = await this.analyze(input);
    return full.forecast;
  }

  async branch(input: TemporalInput) {
    const full = await this.analyze(input);
    return full.branch;
  }

  async schedule(input: TemporalInput) {
    return schedulingEngine.schedule(input);
  }

  async history(blueprintId: string, limit?: number) {
    return listTemporalHistory(blueprintId, limit);
  }

  /** Gate execution when timing says avoid unless urgency critical. */
  async validateExecutionTiming(
    blueprintId: string,
    input?: Partial<TemporalInput>,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const analysis = await this.analyze({ blueprintId, goal: "execution", ...input });
    if (analysis.window.window === "avoid" && analysis.urgency < 0.85) {
      return {
        allowed: false,
        reason: `Temporal window is avoid — ${analysis.recommendation}`,
      };
    }
    return { allowed: true };
  }
}

export const temporalEngine = new TemporalEngine();
