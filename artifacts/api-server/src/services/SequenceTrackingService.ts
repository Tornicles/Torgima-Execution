import {
  db,
  blueprintSequences,
  sequenceFlows,
  goalSequences,
  purposeSequences,
  contextSequences,
  validationSequences,
  validationResultSequences,
  blueprintTierSequences,
  policySequences,
  masterPlanSequences,
  signalSequences,
  miniPlanSequences,
  executionStructureSequences,
  taskGenerationSequences,
  executionFeedbackSequences,
  signalConditionSequences,
  predictionSceneSequences,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  BlueprintSequenceName,
  flowPathForTier,
  sequenceIndex,
  totalSequencesForTier,
  type BlueprintTierKey,
} from "../types/blueprintSequences.js";
import { SequenceTracker } from "../engines/sequence/SequenceTracker.js";

function tierKey(tier?: string | null): BlueprintTierKey {
  if (tier === "growth" || tier === "ultimate") return tier;
  return "starter";
}

async function upsertFlowRow(blueprintId: string, tier: BlueprintTierKey) {
  const flowPath = flowPathForTier(tier);
  const total = totalSequencesForTier(tier);
  const [existing] = await db
    .select()
    .from(sequenceFlows)
    .where(eq(sequenceFlows.blueprint_id, blueprintId))
    .limit(1);
  if (existing) return existing;
  const [row] = await db
    .insert(sequenceFlows)
    .values({
      blueprint_id: blueprintId,
      total_sequences: total,
      flow_path: flowPath,
      current_sequence_name: BlueprintSequenceName.GOAL,
      current_sequence_num: 1,
    })
    .returning();
  await db
    .insert(blueprintSequences)
    .values({
      blueprint_id: blueprintId,
      current_sequence: 1,
      current_sequence_name: BlueprintSequenceName.GOAL,
    })
    .onConflictDoNothing();
  return row;
}

async function markComplete(
  blueprintId: string,
  sequenceName: BlueprintSequenceName,
  tier: BlueprintTierKey,
  state?: Record<string, unknown>,
  valid = true,
) {
  const now = new Date().toISOString();
  const [tracker] = await db
    .select()
    .from(blueprintSequences)
    .where(eq(blueprintSequences.blueprint_id, blueprintId))
    .limit(1);
  const completed = new Set(tracker?.completed_sequences ?? []);
  completed.add(sequenceName);
  const timestamps = { ...((tracker?.sequence_timestamps as Record<string, string>) ?? {}), [sequenceName]: now };
  const states = { ...((tracker?.sequence_states as Record<string, unknown>) ?? {}), ...(state ? { [sequenceName]: state } : {}) };
  const validation = {
    ...((tracker?.sequence_validation as Record<string, boolean>) ?? {}),
    [sequenceName]: valid,
  };

  const path = flowPathForTier(tier);
  const currentIdx = path.indexOf(sequenceName);
  const nextName = currentIdx >= 0 && currentIdx < path.length - 1 ? path[currentIdx + 1] : sequenceName;
  const nextNum = currentIdx >= 0 ? currentIdx + 2 : sequenceIndex(sequenceName, tier);

  await db
    .update(blueprintSequences)
    .set({
      completed_sequences: [...completed],
      sequence_timestamps: timestamps,
      sequence_states: states,
      sequence_validation: validation,
      current_sequence_name: nextName ?? sequenceName,
      current_sequence: nextNum,
    })
    .where(eq(blueprintSequences.blueprint_id, blueprintId));

  await db
    .update(sequenceFlows)
    .set({
      completed_sequences: completed.size,
      current_sequence_name: nextName ?? sequenceName,
      current_sequence_num: nextNum,
      sequence_duration: {
        ...(((
          await db.select().from(sequenceFlows).where(eq(sequenceFlows.blueprint_id, blueprintId)).limit(1)
        )[0]?.sequence_duration as Record<string, string>) ?? {}),
        [sequenceName]: now,
      },
    })
    .where(eq(sequenceFlows.blueprint_id, blueprintId));

  await SequenceTracker.recordCanonicalCheckpoint(blueprintId, sequenceName, {
    stateSnapshot: state,
    validationPassed: valid,
    userAction: `markComplete:${sequenceName}`,
  }).catch(() => null);
}

export const SequenceTrackingService = {
  async ensureInitialized(blueprintId: string, tier?: string | null) {
    const t = tierKey(tier);
    return upsertFlowRow(blueprintId, t);
  },

  async getStatus(blueprintId: string) {
    const [flow] = await db.select().from(sequenceFlows).where(eq(sequenceFlows.blueprint_id, blueprintId)).limit(1);
    const [tracker] = await db
      .select()
      .from(blueprintSequences)
      .where(eq(blueprintSequences.blueprint_id, blueprintId))
      .limit(1);
    if (!flow) return null;
    return {
      blueprintId,
      totalSequences: flow.total_sequences,
      completedCount: flow.completed_sequences,
      currentSequenceNum: flow.current_sequence_num,
      currentSequenceName: flow.current_sequence_name,
      flowPath: flow.flow_path,
      completedSequences: tracker?.completed_sequences ?? [],
      sequenceTimestamps: tracker?.sequence_timestamps ?? {},
      sequenceStates: tracker?.sequence_states ?? {},
      sequenceValidation: tracker?.sequence_validation ?? {},
    };
  },

  async recordGoal(
    blueprintId: string,
    tier: string | null | undefined,
    input: { goalText: string; structured?: Record<string, unknown> },
  ) {
    const t = tierKey(tier);
    await upsertFlowRow(blueprintId, t);
    const s = input.structured ?? {};
    await db
      .insert(goalSequences)
      .values({
        blueprint_id: blueprintId,
        goal_text: input.goalText,
        outcome: String(s["cleanedGoal"] ?? s["outcome"] ?? input.goalText),
        intent: String(s["intent"] ?? ""),
        category: String(s["category"] ?? s["domain"] ?? ""),
        direction: String(s["direction"] ?? ""),
        expected_outputs: Array.isArray(s["successSignals"]) ? (s["successSignals"] as string[]) : [],
        goal_score: typeof s["clarityScore"] === "number" ? s["clarityScore"] : null,
      })
      .onConflictDoUpdate({
        target: goalSequences.blueprint_id,
        set: { goal_text: input.goalText },
      });
    await markComplete(blueprintId, BlueprintSequenceName.GOAL, t, s);
  },

  async recordPurpose(blueprintId: string, tier: string | null | undefined, purposeText: string, structured?: Record<string, unknown>) {
    const t = tierKey(tier);
    await upsertFlowRow(blueprintId, t);
    const s = structured ?? {};
    await db
      .insert(purposeSequences)
      .values({
        blueprint_id: blueprintId,
        purpose_text: purposeText,
        problem: String(s["problem"] ?? ""),
        value: String(s["value"] ?? ""),
        change: String(s["change"] ?? ""),
        mission: String(s["mission"] ?? purposeText),
      })
      .onConflictDoUpdate({
        target: purposeSequences.blueprint_id,
        set: { purpose_text: purposeText },
      });
    await markComplete(blueprintId, BlueprintSequenceName.PURPOSE, t, s);
  },

  async recordContext(
    blueprintId: string,
    tier: string | null | undefined,
    input: {
      timeframe?: number | null;
      location?: string;
      businessType?: string;
      delivery?: string;
      commitment?: string;
      budget?: number;
      limits?: string[];
    },
  ) {
    const t = tierKey(tier);
    await upsertFlowRow(blueprintId, t);
    await db
      .insert(contextSequences)
      .values({
        blueprint_id: blueprintId,
        timeframe: input.timeframe ?? null,
        location: input.location ?? null,
        business_type: input.businessType ?? null,
        delivery: input.delivery ?? null,
        commitment: input.commitment ?? null,
        budget: input.budget ?? null,
        limits: input.limits ?? [],
      })
      .onConflictDoUpdate({
        target: contextSequences.blueprint_id,
        set: {
          timeframe: input.timeframe ?? null,
          location: input.location ?? null,
        },
      });
    await markComplete(blueprintId, BlueprintSequenceName.CONTEXT, t, input as Record<string, unknown>);
  },

  async recordValidation(
    blueprintId: string,
    tier: string | null | undefined,
    input: {
      verdict?: string;
      realityScore?: number;
      paths?: Record<string, unknown>;
      feasibility?: number;
    },
  ) {
    const t = tierKey(tier);
    await upsertFlowRow(blueprintId, t);
    const paths = input.paths ?? {};
    await db
      .insert(validationSequences)
      .values({
        blueprint_id: blueprintId,
        reality_result: input.realityScore != null ? String(input.realityScore) : null,
        feasibility: input.feasibility ?? input.realityScore ?? null,
        verdict: input.verdict ?? null,
        current_path: JSON.stringify(paths["current"] ?? null),
        adjusted_path: JSON.stringify(paths["adjusted"] ?? null),
        alternative_path: JSON.stringify(paths["alternative"] ?? null),
        feasibility_score: input.feasibility ?? input.realityScore ?? null,
      })
      .onConflictDoUpdate({
        target: validationSequences.blueprint_id,
        set: { verdict: input.verdict ?? null, is_active: true },
      });
    await markComplete(blueprintId, BlueprintSequenceName.VALIDATION, t, input as Record<string, unknown>);
  },

  async recordValidationResult(blueprintId: string, tier: string | null | undefined, selectedPath: string) {
    const t = tierKey(tier);
    await db
      .insert(validationResultSequences)
      .values({ blueprint_id: blueprintId, selected_path: selectedPath })
      .onConflictDoUpdate({
        target: validationResultSequences.blueprint_id,
        set: { selected_path: selectedPath },
      });
    await markComplete(blueprintId, BlueprintSequenceName.VALIDATION_RESULT, t, { selectedPath });
  },

  async recordBlueprintTier(blueprintId: string, selectedTier: string) {
    const t = tierKey(selectedTier);
    await upsertFlowRow(blueprintId, t);
    const complexity = t === "ultimate" ? 3 : t === "growth" ? 2 : 1;
    await db
      .insert(blueprintTierSequences)
      .values({
        blueprint_id: blueprintId,
        selected_tier: selectedTier,
        complexity_level: complexity,
        tier_rules: { tier: selectedTier, maxSequences: totalSequencesForTier(t) },
      })
      .onConflictDoUpdate({
        target: blueprintTierSequences.blueprint_id,
        set: { selected_tier: selectedTier, complexity_level: complexity },
      });
    await markComplete(blueprintId, BlueprintSequenceName.BLUEPRINT_TIER, t, { selectedTier });
  },

  async recordLaunchStack(
    blueprintId: string,
    tier: string | null | undefined,
    input: { goal?: string; purpose?: string; selectedPath?: string },
  ) {
    const t = tierKey(tier);
    await upsertFlowRow(blueprintId, t);

    await db
      .insert(policySequences)
      .values({
        blueprint_id: blueprintId,
        do_rules: ["Execute daily proof", "Submit feedback after each order"],
        dont_rules: ["Skip validation gates", "Launch without path selection"],
        winning_rules: ["Narrow market wedge", "Visible proof cadence"],
        failure_patterns: ["Over-scoping before proof"],
      })
      .onConflictDoNothing();

    await db
      .insert(masterPlanSequences)
      .values({
        blueprint_id: blueprintId,
        mission: input.purpose ?? input.goal ?? "Execute validated blueprint",
        success: input.goal ?? "Reach stated outcome with evidence",
        rules: ["One primary order at a time", "Feedback drives next task"],
        governance_type: t === "ultimate" ? "govern" : t === "growth" ? "control" : "guide",
      })
      .onConflictDoNothing();

    await db
      .insert(signalSequences)
      .values({
        blueprint_id: blueprintId,
        signals: ["Production", "Operations", "Growth", "Scale"],
      })
      .onConflictDoNothing();

    await db
      .insert(miniPlanSequences)
      .values({
        blueprint_id: blueprintId,
        mini_plans: ["Foundation", "Operations", "Growth", "Scale"],
        can_compete: t !== "starter",
        can_collaborate: t === "ultimate",
        can_reallocate: t !== "starter",
      })
      .onConflictDoNothing();

    await db
      .insert(executionStructureSequences)
      .values({
        blueprint_id: blueprintId,
        phases: ["initiation", "development", "completion"],
        action_types: ["create", "analyze", "replicate", "improve"],
        targets: {
          major: "Primary outcome",
          primary: input.goal,
          vital: "First proof signal",
        },
        project_structure: { setup: true, execution: true, analysis: true },
      })
      .onConflictDoNothing();

    await db
      .insert(taskGenerationSequences)
      .values({
        blueprint_id: blueprintId,
        current_order_count: 1,
        hidden_queue_length: t === "starter" ? 3 : t === "growth" ? 7 : 14,
        context_injection: ["goal", "purpose", "path", "economy"],
      })
      .onConflictDoNothing();

    for (const name of [
      BlueprintSequenceName.POLICY,
      BlueprintSequenceName.MASTER_PLAN,
      BlueprintSequenceName.SIGNAL,
      BlueprintSequenceName.MINI_PLAN,
      BlueprintSequenceName.EXECUTION_STRUCTURE,
      BlueprintSequenceName.TASK_GENERATION,
    ] as const) {
      await markComplete(blueprintId, name, t);
    }

    if (input.selectedPath) {
      await this.recordValidationResult(blueprintId, tier, input.selectedPath);
    }
  },

  /** Feedback loop: execution → feedback → signals → condition → regeneration → scene */
  async recordFeedbackLoop(
    blueprintId: string,
    tier: string | null | undefined,
    input: {
      completion?: string;
      score?: number;
      reflection?: string;
      condition?: string;
      regenerationTrigger?: string;
    },
  ) {
    const t = tierKey(tier);
    await db
      .insert(executionFeedbackSequences)
      .values({
        blueprint_id: blueprintId,
        completion: input.completion ?? "completed",
        score: input.score ?? 7,
        reflection: input.reflection ?? null,
        execution_output: input.reflection ?? null,
      })
      .onConflictDoUpdate({
        target: executionFeedbackSequences.blueprint_id,
        set: {
          completion: input.completion ?? "completed",
          score: input.score ?? 7,
        },
      });

    await db
      .insert(signalConditionSequences)
      .values({
        blueprint_id: blueprintId,
        signal_progress: Math.min(10, (input.score ?? 7) / 10),
        signal_momentum: (input.score ?? 7) >= 7 ? 0.7 : 0.4,
        current_condition: input.condition ?? "stability",
        adaptation_triggered: (input.score ?? 7) < 5,
        adaptation_type: (input.score ?? 7) < 5 ? "recovery" : undefined,
      })
      .onConflictDoUpdate({
        target: signalConditionSequences.blueprint_id,
        set: {
          current_condition: input.condition ?? "stability",
          adaptation_triggered: (input.score ?? 7) < 5,
        },
      });

    await db
      .insert(predictionSceneSequences)
      .values({
        blueprint_id: blueprintId,
        current_scene: input.condition ?? "stability",
        regeneration_trigger: input.regenerationTrigger ?? "feedback_submitted",
        next_orders: { queued: true },
        how_to_move_forward: "Complete the next order and submit proof.",
      })
      .onConflictDoUpdate({
        target: predictionSceneSequences.blueprint_id,
        set: {
          regeneration_trigger: input.regenerationTrigger ?? "feedback_submitted",
        },
      });

    if (t === "growth" || t === "ultimate") {
      await markComplete(blueprintId, BlueprintSequenceName.ADAPTATION, t, input as Record<string, unknown>);
    }
    await markComplete(blueprintId, BlueprintSequenceName.EXECUTION_FEEDBACK, t, input as Record<string, unknown>);
    await markComplete(blueprintId, BlueprintSequenceName.SIGNAL_CONDITION, t, input as Record<string, unknown>);
    if (t === "ultimate") {
      await markComplete(blueprintId, BlueprintSequenceName.PREDICTION, t, input as Record<string, unknown>);
    }
    await markComplete(blueprintId, BlueprintSequenceName.PREDICTION_SCENE, t, input as Record<string, unknown>, true);
  },
};
