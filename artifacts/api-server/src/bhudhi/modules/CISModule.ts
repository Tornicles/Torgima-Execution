import {
  db,
  bhudhiExecutionEvents,
  bhudhiSignals,
  bhudhiContextStates,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { domainsService } from "../domains/DomainsService.js";
import { eventStatus, recordModuleRun, resolvePhaseFromEventCount } from "./moduleHelpers.js";

export interface ContextAnalysis {
  currentDomain: string;
  currentPhase: string;
  resources: Record<string, unknown>;
  constraints: string[];
  urgency: string;
  clarity: number;
  executionVelocity: number;
  momentumTrend: string;
}

export class CISModule {
  async analyzeContext(blueprintId: string): Promise<ContextAnalysis> {
    const started = Date.now();

    const events = await db
      .select()
      .from(bhudhiExecutionEvents)
      .where(eq(bhudhiExecutionEvents.blueprint_id, blueprintId))
      .orderBy(desc(bhudhiExecutionEvents.created_at))
      .limit(30);

    const [signals] = await db
      .select()
      .from(bhudhiSignals)
      .where(eq(bhudhiSignals.blueprint_id, blueprintId))
      .orderBy(desc(bhudhiSignals.created_at))
      .limit(1);

    const currentDomain = await domainsService.getCurrentDomain(blueprintId);
    const resources = this.analyzeResources();
    const constraints = this.identifyConstraints(events, signals);
    const urgency = this.calculateUrgency(signals);
    const clarity = this.calculateClarity(events, signals);
    const metrics = (signals?.metrics ?? {}) as Record<string, unknown>;

    const context: ContextAnalysis = {
      currentDomain,
      currentPhase: resolvePhaseFromEventCount(events.length),
      resources,
      constraints,
      urgency,
      clarity,
      executionVelocity: events.length,
      momentumTrend: typeof metrics.trend === "string" ? metrics.trend : "stable",
    };

    await db.insert(bhudhiContextStates).values({
      blueprint_id: blueprintId,
      current_domain: context.currentDomain,
      current_phase: context.currentPhase,
      resources: context.resources,
      constraints: context.constraints,
      urgency: context.urgency,
      clarity: context.clarity,
    });

    await recordModuleRun("CIS", Date.now() - started);
    return context;
  }

  private analyzeResources(): Record<string, unknown> {
    return {
      timeAvailable: "40 hours/week",
      budget: "Available",
      teamCapacity: "Full",
      toolsAvailable: true,
    };
  }

  private identifyConstraints(
    events: Array<{ data: unknown }>,
    signals: { global_signal?: string; metrics?: unknown } | undefined,
  ): string[] {
    const constraints: string[] = [];
    if (!signals) constraints.push("Low confidence in current signal");
    if (events.length < 5) constraints.push("Insufficient execution data");

    const metrics = (signals?.metrics ?? {}) as Record<string, unknown>;
    const completionRate = metrics.completionRate;
    if (typeof completionRate === "number" && completionRate < 0.5) {
      constraints.push("Low task completion rate");
    }
    return constraints;
  }

  private calculateUrgency(signals: { global_signal?: string } | undefined): string {
    if (!signals) return "medium";
    if (signals.global_signal === "danger" || signals.global_signal === "urgency") {
      return "high";
    }
    if (signals.global_signal === "power") return "low";
    return "medium";
  }

  private calculateClarity(
    events: unknown[],
    signals: { global_signal?: string } | undefined,
  ): number {
    let clarity = 0.5;
    if (events.length > 10) clarity += 0.1;
    if (events.length > 30) clarity += 0.1;
    if (signals?.global_signal && signals.global_signal !== "nothingness") {
      clarity += 0.2;
    }
    return Math.min(clarity, 1);
  }
}

export const cisModule = new CISModule();
