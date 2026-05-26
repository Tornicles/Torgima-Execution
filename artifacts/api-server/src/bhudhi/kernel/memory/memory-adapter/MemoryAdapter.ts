import {
  db,
  bhudhiSignals,
  bhudhiInvestigations,
  bhudhiRecommendations,
  bhudhiFrameworkLearning,
  bhudhiKernelEvents,
  bhudhiSharedContext,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { MemoryGraph } from "../memory-graph/MemoryGraph.js";

export class MemoryAdapter {
  constructor(private graph: MemoryGraph = new MemoryGraph()) {}

  async migrateSignalMemory(blueprintId: string): Promise<number> {
    const signals = await db
      .select()
      .from(bhudhiSignals)
      .where(eq(bhudhiSignals.blueprint_id, blueprintId));

    for (const signal of signals) {
      await this.graph.addNode({
        blueprintId,
        nodeType: "signal",
        nodeId: signal.id,
        content: {
          globalSignal: signal.global_signal,
          confidence: signal.global_signal_confidence,
          metrics: signal.metrics,
        },
        summary: `Signal: ${signal.global_signal}`,
        sourceEngine: "signal-system",
        confidence: signal.global_signal_confidence,
      });
    }

    return signals.length;
  }

  async migrateInvestigations(blueprintId: string): Promise<number> {
    const investigations = await db
      .select()
      .from(bhudhiInvestigations)
      .where(eq(bhudhiInvestigations.blueprint_id, blueprintId));

    for (const inv of investigations) {
      await this.graph.addNode({
        blueprintId,
        nodeType: "investigation",
        nodeId: inv.id,
        content: inv.findings as Record<string, unknown>,
        summary: `Investigation: ${inv.subject}`,
        sourceEngine: "investigation-system",
        confidence: inv.confidence,
        importance: inv.actionable ? 0.8 : 0.5,
      });
    }

    return investigations.length;
  }

  async migrateRecommendations(blueprintId: string): Promise<number> {
    const recommendations = await db
      .select()
      .from(bhudhiRecommendations)
      .where(eq(bhudhiRecommendations.blueprint_id, blueprintId));

    for (const rec of recommendations) {
      await this.graph.addNode({
        blueprintId,
        nodeType: "decision",
        nodeId: rec.id,
        content: {
          title: rec.title,
          description: rec.description,
          status: rec.status,
          expectedImpact: rec.expected_impact,
        },
        summary: `Recommendation: ${rec.title}`,
        sourceEngine: "intelligence-system",
        confidence: rec.confidence,
      });
    }

    return recommendations.length;
  }

  async migrateFrameworkLearnings(blueprintId: string): Promise<number> {
    const learnings = await db
      .select()
      .from(bhudhiFrameworkLearning)
      .where(eq(bhudhiFrameworkLearning.status, "validated"))
      .limit(50);

    for (const learning of learnings) {
      await this.graph.addNode({
        blueprintId,
        nodeType: "learning",
        nodeId: learning.id,
        content: {
          type: learning.learning_type,
          previousAccuracy: learning.previous_accuracy,
          newAccuracy: learning.new_accuracy,
          improvement: learning.improvement,
        },
        summary: `Learning: ${learning.learning_type}`,
        sourceEngine: "preservation-system",
        confidence: learning.new_accuracy,
      });
    }

    return learnings.length;
  }

  async migrateKernelEvents(blueprintId: string): Promise<number> {
    const events = await db
      .select()
      .from(bhudhiKernelEvents)
      .where(eq(bhudhiKernelEvents.blueprint_id, blueprintId))
      .orderBy(desc(bhudhiKernelEvents.created_at))
      .limit(50);

    for (const ev of events) {
      await this.graph.addNode({
        blueprintId,
        nodeType: "event",
        nodeId: ev.id,
        content: ev.payload as Record<string, unknown>,
        summary: `Event: ${ev.event_type}`,
        sourceEngine: ev.source_engine,
        sourceEvent: ev.id,
      });
    }

    return events.length;
  }

  async migrateSharedContext(blueprintId: string): Promise<number> {
    const [ctx] = await db
      .select()
      .from(bhudhiSharedContext)
      .where(eq(bhudhiSharedContext.blueprint_id, blueprintId))
      .limit(1);

    if (!ctx) return 0;

    await this.graph.addNode({
      blueprintId,
      nodeType: "world",
      nodeId: `shared-context-${blueprintId}`,
      content: {
        domain: ctx.domain,
        phase: ctx.phase,
        signal: ctx.signal,
        strategy: ctx.strategy,
        execution: ctx.execution,
        investigations: ctx.investigations,
      },
      summary: `Shared context: ${ctx.domain} · ${ctx.phase}`,
      sourceEngine: "kernel",
      importance: 0.9,
    });

    return 1;
  }

  async migrateAll(blueprintId: string) {
    const counts = {
      signals: await this.migrateSignalMemory(blueprintId),
      investigations: await this.migrateInvestigations(blueprintId),
      recommendations: await this.migrateRecommendations(blueprintId),
      learnings: await this.migrateFrameworkLearnings(blueprintId),
      events: await this.migrateKernelEvents(blueprintId),
      sharedContext: await this.migrateSharedContext(blueprintId),
    };

    const stats = await this.graph.getStats(blueprintId);

    return {
      success: true,
      message: "All memory migrated to unified graph",
      counts,
      stats,
    };
  }
}

export const memoryAdapter = new MemoryAdapter();
