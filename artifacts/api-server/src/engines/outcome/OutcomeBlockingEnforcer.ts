/**
 * DOC20 Task 5 — six downstream blocking rules (extends Erector Prompt 8 enforcer).
 */

export {
  enforceTargetCompletion,
  enforcePhaseAdvancement,
  enforceOutcomeReward,
  enforceIdentityAdvancement,
  enforceCapabilityUpgrade,
  enforceDashboardSuccessCopy,
  assertTargetCompletionAllowed,
  loadBlueprintArchetype,
  type BlockingResult,
} from "../erector/OutcomeBlockingEnforcer.js";

import {
  enforceTargetCompletion,
  enforcePhaseAdvancement,
  enforceOutcomeReward,
  enforceIdentityAdvancement,
  enforceCapabilityUpgrade,
  enforceDashboardSuccessCopy,
} from "../erector/OutcomeBlockingEnforcer.js";
import type { BlockingResult } from "../erector/OutcomeBlockingEnforcer.js";
import type { ValidationStatus } from "./outcomeTypes.js";

export type OutcomeEnforcementResult = {
  targetCompletion: BlockingResult;
  phaseAdvancement: BlockingResult;
  outcomeReward: BlockingResult;
  identityAdvancement: BlockingResult;
  dashboardCopy: BlockingResult;
};

export class OutcomeBlockingEnforcer {
  /** Apply all blueprint-scoped blocking rules for a validation verdict. */
  static async enforce(params: {
    userId: string;
    blueprintId: string;
    status: ValidationStatus;
    capabilityId?: string;
  }): Promise<OutcomeEnforcementResult> {
    const [targetCompletion, phaseAdvancement, outcomeReward, identityAdvancement] =
      await Promise.all([
        enforceTargetCompletion({
          blueprintId: params.blueprintId,
          userId: params.userId,
          validationStatus: params.status,
        }),
        enforcePhaseAdvancement({
          blueprintId: params.blueprintId,
          userId: params.userId,
        }),
        enforceOutcomeReward({
          blueprintId: params.blueprintId,
          userId: params.userId,
          validationStatus: params.status,
        }),
        enforceIdentityAdvancement({
          blueprintId: params.blueprintId,
          userId: params.userId,
        }),
      ]);

    const dashboardCopy = enforceDashboardSuccessCopy(params.status);

    if (params.capabilityId) {
      await enforceCapabilityUpgrade({
        blueprintId: params.blueprintId,
        userId: params.userId,
        capabilityId: params.capabilityId,
      }).catch(() => null);
    }

    return {
      targetCompletion,
      phaseAdvancement,
      outcomeReward,
      identityAdvancement,
      dashboardCopy,
    };
  }
}
