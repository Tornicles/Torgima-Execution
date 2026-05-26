import { blueprints, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SequenceTracker } from "../sequence/SequenceTracker.js";
import { ContinuousValidation } from "./ContinuousValidation.js";
import { EmergencyOrderSystem } from "./EmergencyOrderSystem.js";
import { PredictionEngine } from "./PredictionEngine.js";
import { SceneEngine } from "./SceneEngine.js";
import { ULTIMATE_SEQUENCE_NUMBER, isUltimateUnlocked, requireUltimateAccess } from "./ultimateGate.js";

export const UltimateIntelligenceService = {
  async runAfterFeedback(blueprintId: string, userId: string) {
    try {
      const row = await requireUltimateAccess(blueprintId);
      if (!isUltimateUnlocked(row)) return { skipped: true, reason: "ultimate_locked" };

      const history = await PredictionEngine.buildHistoryFromOrders(blueprintId);
      const prediction = await PredictionEngine.predictNextTask(blueprintId, history);
      const recordedPrediction = await PredictionEngine.recordPrediction(blueprintId, prediction);

      const scene = await SceneEngine.createScene(blueprintId);
      const validation = await ContinuousValidation.validate(blueprintId);

      let emergency: Awaited<ReturnType<typeof EmergencyOrderSystem.getPendingOrders>> = [];
      if (validation.recovery_needed && validation.checkpoint.recovery_type) {
        await EmergencyOrderSystem.createRecoveryOrder(
          blueprintId,
          userId,
          validation.checkpoint.recovery_type,
        );
      }

      const topBlocker = prediction.predicted_blockers[0];
      if (topBlocker && prediction.blocker_risk > 0.6) {
        await EmergencyOrderSystem.createBlockerResolutionOrder(blueprintId, userId, topBlocker);
      }

      const topOpportunity = scene.scene.opportunity_gaps?.[0];
      if (topOpportunity && scene.divergence < 0.35) {
        await EmergencyOrderSystem.createOpportunityOrder(blueprintId, topOpportunity);
      }

      emergency = await EmergencyOrderSystem.getPendingOrders(blueprintId);

      await SequenceTracker.recordCheckpoint(blueprintId, ULTIMATE_SEQUENCE_NUMBER, {
        userAction: "Ultimate intelligence cycle",
        stateSnapshot: {
          prediction_id: recordedPrediction.id,
          scene_id: scene.scene.id,
          validation_valid: validation.valid,
          emergency_count: emergency.length,
        },
        validationPassed: validation.valid,
      }).catch(() => null);

      return {
        skipped: false,
        prediction: recordedPrediction,
        scene: scene.scene,
        validation,
        emergency,
        accuracy: await PredictionEngine.getPredictionAccuracy(blueprintId),
      };
    } catch {
      return { skipped: true, reason: "ultimate_not_available" };
    }
  },

  async getDashboardSummary(blueprintId: string) {
    const [bp] = await db
      .select({ user_id: blueprints.user_id })
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1);

    return {
      accuracy: await PredictionEngine.getPredictionAccuracy(blueprintId),
      scene: await SceneEngine.getLatestScene(blueprintId),
      validation: await ContinuousValidation.getRecentCheckpoints(blueprintId, 3),
      emergency: await EmergencyOrderSystem.getPendingOrders(blueprintId),
      userId: bp?.user_id,
    };
  },
};
