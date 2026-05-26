/**
 * Prompt 39B — End-to-end blueprint sequence orchestration.
 */
import { db, blueprints } from "@workspace/db";
import { eq } from "drizzle-orm";
import { BlueprintEngine } from "../engines/blueprint/BlueprintEngine.js";
import { recordExecutionStructureFromBlueprint } from "../engines/sequence/sequenceExecutionStructureService.js";
import { syncTaskGenerationSequence } from "../engines/sequence/sequenceTaskQueueService.js";
import { ValidationService } from "./ValidationService.js";
import { SequenceTrackingService } from "./SequenceTrackingService.js";
import { BlueprintLaunchService } from "./BlueprintLaunchService.js";
import type { LaunchPathType } from "./BlueprintLaunchService.js";

const blueprintEngine = new BlueprintEngine();

export interface CreateCompleteBlueprintInput {
  userId: string;
  goal: string;
  purpose: string;
  timeframe?: number;
  location?: string;
  businessType?: string;
  delivery?: string;
  commitment?: string;
  budget?: number;
  limits?: string[];
  tier?: "starter" | "growth" | "ultimate";
  validationContractId?: string;
  selectedPath?: LaunchPathType;
  domainHint?: string;
}

export const SequenceOrchestrationService = {
  /**
   * Runs sequences 1–5 during onboarding-style setup (goal → validation result path stored externally).
   */
  async runOnboardingSequences(
    blueprintId: string,
    input: {
      goal: string;
      purpose: string;
      tier?: string | null;
      structuredGoal?: Record<string, unknown>;
      context?: Parameters<typeof SequenceTrackingService.recordContext>[2];
    },
  ) {
    const tier = input.tier ?? "starter";
    await SequenceTrackingService.ensureInitialized(blueprintId, tier);
    await SequenceTrackingService.recordGoal(blueprintId, tier, {
      goalText: input.goal,
      structured: input.structuredGoal,
    });
    await SequenceTrackingService.recordPurpose(blueprintId, tier, input.purpose, input.structuredGoal);
    if (input.context) {
      await SequenceTrackingService.recordContext(blueprintId, tier, input.context);
    }
    return SequenceTrackingService.getStatus(blueprintId);
  },

  /**
   * Prompt 39B — full flow through launch: sequences 6–17 + task queue sync.
   */
  async completeBlueprintThroughLaunch(input: {
    blueprintId: string;
    userId: string;
    validationContractId: string;
    selectedPath: LaunchPathType;
    tier: "starter" | "growth" | "ultimate";
  }) {
    const launch = await BlueprintLaunchService.launch({
      blueprintId: input.blueprintId,
      userId: input.userId,
      validationContractId: input.validationContractId,
      selectedPathType: input.selectedPath,
      selectedBlueprintLevel: input.tier,
    });

    const structure = await recordExecutionStructureFromBlueprint(input.blueprintId, input.tier);
    const taskQueue = await syncTaskGenerationSequence(input.blueprintId, input.tier);
    const status = await SequenceTrackingService.getStatus(input.blueprintId);

    return { launch, structure, taskQueue, sequenceStatus: status };
  },

  /**
   * Creates draft blueprint and runs sequences 1–3 (goal, purpose, context).
   */
  async createCompleteBlueprint(input: CreateCompleteBlueprintInput) {
    const tier = input.tier ?? "starter";
    const { blueprintId } = await blueprintEngine.createDraft(input.userId, {
      goal: input.goal,
      purpose: input.purpose,
      domainHint: input.domainHint,
      timeframeDays: input.timeframe,
    });

    const structured = await ValidationService.structureGoal({
      userId: input.userId,
      blueprintId,
      input: { goal: input.goal, purpose: input.purpose },
    }).catch(() => ({} as Record<string, unknown>));

    await db
      .update(blueprints)
      .set({
        purpose: input.purpose,
        timeframe_days: input.timeframe ?? null,
        tier,
        selected_blueprint_level: tier,
      })
      .where(eq(blueprints.id, blueprintId));

    const sequenceStatus = await this.runOnboardingSequences(blueprintId, {
      goal: input.goal,
      purpose: input.purpose,
      tier,
      structuredGoal: structured as Record<string, unknown>,
      context: {
        timeframe: input.timeframe,
        location: input.location,
        businessType: input.businessType,
        delivery: input.delivery,
        commitment: input.commitment,
        budget: input.budget,
        limits: input.limits,
      },
    });

    let launchResult: Awaited<ReturnType<typeof this.completeBlueprintThroughLaunch>> | undefined;
    if (input.validationContractId && input.selectedPath) {
      launchResult = await this.completeBlueprintThroughLaunch({
        blueprintId,
        userId: input.userId,
        validationContractId: input.validationContractId,
        selectedPath: input.selectedPath,
        tier,
      });
    }

    return {
      blueprintId,
      sequenceStatus,
      launch: launchResult?.launch,
      firstOrders: launchResult?.taskQueue,
      message: launchResult
        ? "Blueprint created, launched, and sequence flow complete through task generation"
        : "Blueprint created; complete validation and call launch to finish sequences 4–17",
    };
  },
};
