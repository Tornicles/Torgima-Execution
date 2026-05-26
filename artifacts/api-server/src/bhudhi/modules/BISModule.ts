import { db, bhudhiExecutionEvents, bhudhiSignals } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { eventStatus, recordModuleRun } from "./moduleHelpers.js";

export interface BehaviorAnalysis {
  adoptionLikelihood: number;
  resistancePoints: string[];
  motivationLevel: string;
  changeReadiness: number;
  teamAlignment: number;
}

export class BISModule {
  async analyzeBehavior(blueprintId: string): Promise<BehaviorAnalysis> {
    const started = Date.now();

    const [signals] = await db
      .select()
      .from(bhudhiSignals)
      .where(eq(bhudhiSignals.blueprint_id, blueprintId))
      .orderBy(desc(bhudhiSignals.created_at))
      .limit(1);

    const events = await db
      .select()
      .from(bhudhiExecutionEvents)
      .where(eq(bhudhiExecutionEvents.blueprint_id, blueprintId))
      .orderBy(desc(bhudhiExecutionEvents.created_at))
      .limit(20);

    const result: BehaviorAnalysis = {
      adoptionLikelihood: this.predictAdoption(signals),
      resistancePoints: this.identifyResistance(events),
      motivationLevel: this.assessMotivation(signals),
      changeReadiness: Math.min(events.length / 50, 1),
      teamAlignment: this.assessAlignment(events),
    };

    await recordModuleRun("BIS", Date.now() - started);
    return result;
  }

  private predictAdoption(signals: { global_signal?: string } | undefined): number {
    if (!signals) return 0.5;
    if (signals.global_signal === "power") return 0.9;
    if (signals.global_signal === "danger") return 0.3;
    return 0.65;
  }

  private identifyResistance(events: Array<{ data: unknown }>): string[] {
    const failedCount = events.filter((e) => eventStatus(e.data) === "failed").length;
    if (failedCount > 5) return ["High failure rate is causing resistance"];
    return [];
  }

  private assessMotivation(signals: { global_signal?: string } | undefined): string {
    if (!signals) return "unknown";
    if (signals.global_signal === "power") return "high";
    if (signals.global_signal === "danger") return "low";
    return "moderate";
  }

  private assessAlignment(events: Array<{ data: unknown }>): number {
    const completed = events.filter((e) => eventStatus(e.data) === "completed").length;
    return completed / Math.max(events.length, 1);
  }
}

export const bisModule = new BISModule();
