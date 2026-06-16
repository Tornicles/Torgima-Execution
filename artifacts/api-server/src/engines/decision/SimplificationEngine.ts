/**
 * DOC23 Task 3 — simplification responses by cognitive load level.
 * Never overrides enforcement package constraints.
 */

import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import type { CognitiveLoadLevel } from "./decisionTypes.js";

export async function applySimplification(params: {
  userId: string;
  blueprintId: string;
  loadLevel: CognitiveLoadLevel;
  loadScore: number;
  enforcementTaskMin?: number;
}): Promise<void> {
  const minVisibleActions = Math.max(1, params.enforcementTaskMin ?? 1);
  const base = {
    userId: params.userId,
    blueprintId: params.blueprintId,
    entityType: "blueprint" as const,
    entityId: params.blueprintId,
  };

  if (params.loadLevel === "MEDIUM") {
    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.COGNITIVE_LOAD_HIGH,
      payload: {
        action: "SIMPLIFY",
        load_level: params.loadLevel,
        load_score: params.loadScore,
        max_user_facing_options: 2,
        hide_advanced_options: true,
        enforcement_respected: true,
        min_visible_actions: minVisibleActions,
      },
      idempotencyKey: `simplify:${params.blueprintId}:${Math.floor(Date.now() / 3600000)}`,
    }).catch(() => null);
    return;
  }

  if (params.loadLevel === "HIGH") {
    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.CLARIFICATION_TASK_REQUESTED,
      payload: {
        trigger: "cognitive_load_high",
        load_score: params.loadScore,
        simplify_instruction: true,
        enforcement_respected: true,
      },
      idempotencyKey: `clarify_load:${params.blueprintId}:${Math.floor(Date.now() / 3600000)}`,
    }).catch(() => null);
    return;
  }

  if (params.loadLevel === "CRITICAL") {
    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.REDUCE_DECISION_BURDEN_REQUESTED,
      payload: {
        load_level: "CRITICAL",
        load_score: params.loadScore,
        max_visible_actions: minVisibleActions,
        hide_nonessential_ui: true,
        enforcement_respected: true,
      },
      idempotencyKey: `reduce_burden:${params.blueprintId}:${Math.floor(Date.now() / 86400000)}`,
    }).catch(() => null);

    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.CONDITION_EVALUATION_REQUESTED,
      payload: {
        trigger: "cognitive_load_critical",
        load_score: params.loadScore,
      },
      idempotencyKey: `condition_eval:load:${params.blueprintId}`,
    }).catch(() => null);
  }
}
