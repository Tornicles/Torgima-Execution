import { randomUUID } from "node:crypto";
import { investigationService } from "../../investigation/InvestigationService.js";
import { intelligenceService } from "../../intelligence/IntelligenceService.js";
import { operatingService } from "../../operating/OperatingService.js";
import { securityService } from "../../security/SecurityService.js";
import { preservationService } from "../../preservation/PreservationService.js";
import { approveRecommendation } from "../../operating/operatingData.js";
import { eventBus, EventBus } from "../event-bus/EventBus.js";
import { sharedContextService, SharedContextService } from "../shared-context/SharedContext.js";
import {
  completeExecutionContract,
  createExecutionContract,
  ensureEngineRegistry,
  listEngineRegistry,
} from "../kernelData.js";
import type { CycleResult, StoredKernelEvent } from "../contracts/types.js";
import { syncCycleToMemoryGraph } from "../memory/syncCycleToGraph.js";
import { recordProtocolStep } from "../../protocol/recordProtocolStep.js";
import { logger } from "../../../lib/logger.js";

/**
 * Unified Bhudhi Cognitive Kernel — one execution contract, event bus, shared context.
 */
export class CognitiveKernel {
  private readonly bus: EventBus;
  private readonly context: SharedContextService;
  private handlersRegistered = false;

  constructor(bus: EventBus = eventBus, context: SharedContextService = sharedContextService) {
    this.bus = bus;
    this.context = context;
  }

  getEventBus(): EventBus {
    return this.bus;
  }

  getSharedContext(): SharedContextService {
    return this.context;
  }

  async getRegistry() {
    await ensureEngineRegistry();
    return listEngineRegistry();
  }

  private registerHandlers(): void {
    if (this.handlersRegistered) return;

    this.bus.subscribe(
      "investigation.start",
      async (event) => {
        const investigations = await investigationService.investigateBlueprint(event.blueprintId);
        await this.context.updateSubsystem(
          event.blueprintId,
          "investigations",
          { items: investigations, count: investigations.length },
          "investigation",
        );

        await this.bus.publish({
          blueprintId: event.blueprintId,
          eventType: "investigation.complete",
          sourceEngine: "investigation",
          targetEngine: "intelligence",
          payload: { investigations },
          chainId: event.chainId,
          parentEventId: event.id,
        });
      },
      "investigationHandler",
    );

    this.bus.subscribe(
      "investigation.complete",
      async (event) => {
        await this.bus.publish({
          blueprintId: event.blueprintId,
          eventType: "intelligence.start",
          sourceEngine: "kernel",
          targetEngine: "intelligence",
          payload: event.payload,
          chainId: event.chainId,
          parentEventId: event.id,
        });
      },
      "investigationCompleteRelay",
    );

    this.bus.subscribe(
      "intelligence.start",
      async (event) => {
        const recommendations = await intelligenceService.analyzeAndRecommend(event.blueprintId);
        const top = recommendations[0] ?? null;

        await this.context.updateSubsystem(
          event.blueprintId,
          "strategy",
          { recommendation: top, count: recommendations.length },
          "intelligence",
        );

        await this.context.updateSubsystem(
          event.blueprintId,
          "ideas",
          { recommendations: recommendations.map((r) => ({ id: r.id, title: r.title })) },
          "intelligence",
        );

        await this.bus.publish({
          blueprintId: event.blueprintId,
          eventType: "intelligence.complete",
          sourceEngine: "intelligence",
          targetEngine: "security",
          payload: { recommendations, top },
          chainId: event.chainId,
          parentEventId: event.id,
        });
      },
      "intelligenceHandler",
    );

    this.bus.subscribe(
      "intelligence.complete",
      async (event) => {
        const top = (event.payload.top as { id: string } | null) ?? null;
        if (!top?.id) {
          await this.bus.publish({
            blueprintId: event.blueprintId,
            eventType: "security.rejected",
            sourceEngine: "security",
            payload: { violations: ["No recommendation to validate"] },
            chainId: event.chainId,
            parentEventId: event.id,
          });
          return;
        }

        await this.bus.publish({
          blueprintId: event.blueprintId,
          eventType: "security.validate",
          sourceEngine: "kernel",
          targetEngine: "security",
          payload: { recommendation: top },
          chainId: event.chainId,
          parentEventId: event.id,
        });
      },
      "intelligenceCompleteRelay",
    );

    this.bus.subscribe(
      "security.validate",
      async (event) => {
        const recommendation = event.payload.recommendation as { id: string };
        const validation = await securityService.validateRecommendation(
          recommendation.id,
          event.blueprintId,
        );

        if (validation.valid) {
          await this.context.updateSubsystem(
            event.blueprintId,
            "behavior",
            { security: "approved", violations: [] },
            "security",
          );

          await this.bus.publish({
            blueprintId: event.blueprintId,
            eventType: "security.approved",
            sourceEngine: "security",
            targetEngine: "operating",
            payload: { recommendation },
            chainId: event.chainId,
            parentEventId: event.id,
          });
        } else {
          await this.context.updateSubsystem(
            event.blueprintId,
            "behavior",
            { security: "rejected", violations: validation.violations },
            "security",
          );

          await this.bus.publish({
            blueprintId: event.blueprintId,
            eventType: "security.rejected",
            sourceEngine: "security",
            payload: { violations: validation.violations },
            chainId: event.chainId,
            parentEventId: event.id,
          });
        }
      },
      "securityHandler",
    );

    this.bus.subscribe(
      "security.approved",
      async (event) => {
        await this.bus.publish({
          blueprintId: event.blueprintId,
          eventType: "operating.execute",
          sourceEngine: "kernel",
          targetEngine: "operating",
          payload: event.payload,
          chainId: event.chainId,
          parentEventId: event.id,
        });
      },
      "securityApprovedRelay",
    );

    this.bus.subscribe(
      "operating.execute",
      async (event) => {
        const recommendation = event.payload.recommendation as { id: string };
        await approveRecommendation(recommendation.id);

        const result = await operatingService.executeRecommendation(recommendation.id);

        await this.context.updateSubsystem(
          event.blueprintId,
          "execution",
          { result, recommendationId: recommendation.id },
          "operating",
        );

        await this.context.updateContext(
          event.blueprintId,
          { phase: result.success ? "execution" : "review" },
          "operating",
        );

        await this.bus.publish({
          blueprintId: event.blueprintId,
          eventType: "operating.complete",
          sourceEngine: "operating",
          targetEngine: "preservation",
          payload: { result },
          chainId: event.chainId,
          parentEventId: event.id,
        });
      },
      "operatingHandler",
    );

    this.bus.subscribe(
      "operating.complete",
      async (event) => {
        await this.bus.publish({
          blueprintId: event.blueprintId,
          eventType: "preservation.learn",
          sourceEngine: "kernel",
          targetEngine: "preservation",
          payload: event.payload,
          chainId: event.chainId,
          parentEventId: event.id,
        });
      },
      "operatingCompleteRelay",
    );

    this.bus.subscribe(
      "preservation.learn",
      async (event) => {
        const learned = await preservationService.consolidateKnowledge(event.blueprintId);

        await this.context.updateSubsystem(
          event.blueprintId,
          "knowledge",
          { learned, consolidatedAt: new Date().toISOString() },
          "preservation",
        );

        await this.bus.publish({
          blueprintId: event.blueprintId,
          eventType: "preservation.complete",
          sourceEngine: "preservation",
          payload: { learned: true, result: learned },
          chainId: event.chainId,
          parentEventId: event.id,
        });
      },
      "preservationHandler",
    );

    this.handlersRegistered = true;
  }

  /**
   * Run unified Bhudhi cycle — sequential pipeline with event chain tracking.
   */
  /** Register event-bus handlers for event-only workflows (optional). */
  enableEventHandlers(): void {
    this.registerHandlers();
  }

  async runCycle(blueprintId: string): Promise<CycleResult> {
    await ensureEngineRegistry();

    const chainId = `cycle_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const eventIds: string[] = [];
    const contractId = await createExecutionContract({
      blueprintId,
      contractType: "kernel.cycle",
      input: { blueprintId },
      eventChainId: chainId,
    });

    try {
      await this.runSequentialPipeline(blueprintId, chainId, eventIds);

      const finalContext = await this.context.getContext(blueprintId);
      const validation = await this.context.validateContext(blueprintId);

      const completeId = await this.bus.publish({
        blueprintId,
        eventType: "kernel.cycle.complete",
        sourceEngine: "kernel",
        payload: { validation, version: finalContext.version },
        chainId,
      });
      eventIds.push(completeId);

      await completeExecutionContract(contractId, { context: finalContext, validation }, eventIds);

      try {
        await syncCycleToMemoryGraph(blueprintId, finalContext, chainId);
      } catch (err) {
        logger.warn({ err, blueprintId }, "[CognitiveKernel] memory graph sync skipped");
      }

      return {
        chainId,
        context: finalContext,
        eventIds,
        contracts: [contractId],
        status: "completed",
        message: "Unified Bhudhi cycle completed",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, blueprintId, chainId }, "[CognitiveKernel] cycle failed");
      await completeExecutionContract(contractId, {}, eventIds, message);

      const ctx = await this.context.getContext(blueprintId);
      return {
        chainId,
        context: ctx,
        eventIds,
        contracts: [contractId],
        status: "failed",
        message,
      };
    }
  }

  /** Direct sequential execution (reliable) while event handlers remain for extension. */
  private async runSequentialPipeline(
    blueprintId: string,
    chainId: string,
    eventIds: string[],
  ): Promise<void> {
    let parentId: string | undefined;

    const investigations = await investigationService.investigateBlueprint(blueprintId);
    await this.context.updateSubsystem(
      blueprintId,
      "investigations",
      { items: investigations, count: investigations.length },
      "investigation",
    );
    parentId = await this.bus.publish({
      blueprintId,
      eventType: "investigation.complete",
      sourceEngine: "investigation",
      targetEngine: "intelligence",
      payload: { investigations },
      chainId,
      parentEventId: parentId,
    });
    eventIds.push(parentId);
    await recordProtocolStep(
      blueprintId,
      "investigation",
      "intelligence",
      "bhudhi://investigation/complete",
      { investigations, chainId },
    );

    const recommendations = await intelligenceService.analyzeAndRecommend(blueprintId);
    const top = recommendations[0] ?? null;
    await this.context.updateSubsystem(
      blueprintId,
      "strategy",
      { recommendation: top, count: recommendations.length },
      "intelligence",
    );
    parentId = await this.bus.publish({
      blueprintId,
      eventType: "intelligence.complete",
      sourceEngine: "intelligence",
      targetEngine: "security",
      payload: { recommendations, top },
      chainId,
      parentEventId: parentId,
    });
    eventIds.push(parentId);
    await recordProtocolStep(
      blueprintId,
      "intelligence",
      "security",
      "bhudhi://intelligence/recommend",
      { recommendations, top, chainId },
    );

    if (!top?.id) {
      await this.bus.publish({
        blueprintId,
        eventType: "security.rejected",
        sourceEngine: "security",
        payload: { violations: ["No recommendation generated"] },
        chainId,
        parentEventId: parentId,
      });
      return;
    }

    const validation = await securityService.validateRecommendation(top.id, blueprintId);
    if (!validation.valid) {
      await this.context.updateSubsystem(
        blueprintId,
        "behavior",
        { security: "rejected", violations: validation.violations },
        "security",
      );
      await this.bus.publish({
        blueprintId,
        eventType: "security.rejected",
        sourceEngine: "security",
        payload: { violations: validation.violations },
        chainId,
        parentEventId: parentId,
      });
      return;
    }

    await this.context.updateSubsystem(
      blueprintId,
      "behavior",
      { security: "approved" },
      "security",
    );
    parentId = await this.bus.publish({
      blueprintId,
      eventType: "security.approved",
      sourceEngine: "security",
      targetEngine: "operating",
      payload: { recommendation: top },
      chainId,
      parentEventId: parentId,
    });
    eventIds.push(parentId);
    await recordProtocolStep(
      blueprintId,
      "security",
      "operating",
      "bhudhi://security/validate",
      { recommendation: top, chainId },
    );

    await approveRecommendation(top.id);
    const opResult = await operatingService.executeRecommendation(top.id);
    await this.context.updateSubsystem(
      blueprintId,
      "execution",
      { result: opResult, recommendationId: top.id },
      "operating",
    );
    parentId = await this.bus.publish({
      blueprintId,
      eventType: "operating.complete",
      sourceEngine: "operating",
      targetEngine: "preservation",
      payload: { result: opResult },
      chainId,
      parentEventId: parentId,
    });
    eventIds.push(parentId);
    await recordProtocolStep(
      blueprintId,
      "operating",
      "preservation",
      "bhudhi://operating/execute",
      { result: opResult, chainId },
    );

    const learned = await preservationService.consolidateKnowledge(blueprintId);
    await this.context.updateSubsystem(
      blueprintId,
      "knowledge",
      { learned, consolidatedAt: new Date().toISOString() },
      "preservation",
    );
    parentId = await this.bus.publish({
      blueprintId,
      eventType: "preservation.complete",
      sourceEngine: "preservation",
      payload: { learned: true, result: learned },
      chainId,
      parentEventId: parentId,
    });
    eventIds.push(parentId);
    await recordProtocolStep(
      blueprintId,
      "preservation",
      "intelligence",
      "bhudhi://preservation/learn",
      { learned: true, result: learned, chainId },
    );
  }

  async getEventChain(chainId: string): Promise<StoredKernelEvent[]> {
    return this.bus.getChain(chainId);
  }
}

export const cognitiveKernel = new CognitiveKernel();
