import { eq } from "drizzle-orm";
import { db, academyTasks, blueprints, erectorCapabilityGaps } from "@workspace/db";
import { logger } from "../../../lib/logger.js";
import { EVENT_TYPES, writeEvent } from "../../../services/EventService.js";
import {
  determineLearningType,
  selectAcademyContent,
} from "./AcademyContentSelector.js";
import type { CapabilityGapItem } from "./types.js";

async function getCurrentCondition(blueprintId: string): Promise<string> {
  const [row] = await db
    .select({ current_condition: blueprints.current_condition })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  return row?.current_condition ?? "stability";
}

async function writeCapabilityGap(input: {
  userId: string;
  blueprintId: string;
  gap: CapabilityGapItem;
}): Promise<string> {
  const [row] = await db
    .insert(erectorCapabilityGaps)
    .values({
      user_id: input.userId,
      blueprint_id: input.blueprintId,
      capability_id: input.gap.capability_id,
      current_proof_level: input.gap.current_proof_level,
      required_proof_level: input.gap.required_proof_level,
      missing_evidence: input.gap.missing_evidence,
      block_level: input.gap.block_level,
      blocks_execution: input.gap.blocks_execution,
      unblock_condition: `Submit academy proof that satisfies ${input.gap.capability_name} requirements`,
      status: "open",
    })
    .returning({ id: erectorCapabilityGaps.id });

  if (!row) throw new Error("Failed to write capability gap");
  return row.id;
}

async function createErectorAcademyTask(input: {
  blueprintId: string;
  userId: string;
  capabilityGapId: string;
  gap: CapabilityGapItem;
  learningType: string;
  domain: string;
  phase: string;
  tier: string;
  condition: string;
}): Promise<string> {
  const content = await selectAcademyContent({
    capabilityId: input.gap.capability_id,
    learningType: input.learningType as never,
    domain: input.domain,
    phase: input.phase,
    tier: input.tier,
    condition: input.condition,
  });

  const [task] = await db
    .insert(academyTasks)
    .values({
      blueprint_id: input.blueprintId,
      user_id: input.userId,
      capability_gap_id: input.capabilityGapId,
      learning_type: input.learningType,
      execution_requirement: content.execution_task_description,
      title: content.title,
      description: content.explanation,
      learning_content: content.learning_content,
      trigger_reason: `Capability gap: ${input.gap.capability_name}`,
      domain: input.domain,
      skill_target: input.gap.capability_id,
      proof_required: true,
      proof_description: content.proof_description,
      blocks_execution: input.gap.blocks_execution,
      status: "pending",
    })
    .returning({ id: academyTasks.id });

  if (!task) throw new Error("Failed to create academy task");

  await db
    .update(erectorCapabilityGaps)
    .set({ academy_task_id: task.id, status: "in_academy" })
    .where(eq(erectorCapabilityGaps.id, input.capabilityGapId));

  await writeEvent({
    eventType: EVENT_TYPES.ACADEMY_TASK_REQUESTED,
    entityType: "academy_task",
    entityId: task.id,
    userId: input.userId,
    blueprintId: input.blueprintId,
    payload: {
      academy_task_id: task.id,
      capability_gap_id: input.capabilityGapId,
      capability_id: input.gap.capability_id,
      learning_type: input.learningType,
    },
    idempotencyKey: `academy_task_requested:${task.id}`,
  }).catch(() => null);

  return task.id;
}

export async function handleCapabilityGapDetected(input: {
  userId: string;
  blueprintId: string;
  gaps: CapabilityGapItem[];
  blockedTaskType: string;
  domain: string;
  phase: string;
  tier: string;
}): Promise<{ academyTaskIds: string[] }> {
  const condition = await getCurrentCondition(input.blueprintId);
  const academyTaskIds: string[] = [];

  for (const gap of input.gaps.filter((row) => row.academy_task_needed)) {
    const capabilityGapId = await writeCapabilityGap({
      userId: input.userId,
      blueprintId: input.blueprintId,
      gap,
    });

    const learningType = determineLearningType(condition);
    const academyTaskId = await createErectorAcademyTask({
      blueprintId: input.blueprintId,
      userId: input.userId,
      capabilityGapId,
      gap,
      learningType,
      domain: input.domain,
      phase: input.phase,
      tier: input.tier,
      condition,
    });

    academyTaskIds.push(academyTaskId);
  }

  logger.info(
    {
      blueprintId: input.blueprintId,
      blockedTaskType: input.blockedTaskType,
      academyTaskIds,
      gapCount: input.gaps.length,
    },
    "[AcademyRuntime] Capability gaps routed to academy",
  );

  return { academyTaskIds };
}
