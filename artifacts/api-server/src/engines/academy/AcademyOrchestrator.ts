/**
 * Prompt 10 — routes CAPABILITY_GAP failures into Academy (LAW 3: system-triggered only).
 */
import { db, orders } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  detectCapabilityGap,
  logCapabilityGap,
  type CapabilityGap,
} from "./CapabilityGapEngine.js";
import { generateLearningPath } from "./LearningPathGenerator.js";
import { logger } from "../../lib/logger.js";

export async function routeCapabilityGapToAcademy(params: {
  userId: string;
  blueprintId: string;
  orderId: string;
  failureCategory: string;
  reflection?: string;
}): Promise<{ routed: boolean; learningPathId?: string; orderId?: string }> {
  const [order] = await db
    .select({
      instruction: orders.instruction,
      title: orders.title,
    })
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);

  const gap = await detectCapabilityGap({
    userId: params.userId,
    blueprintId: params.blueprintId,
    orderId: params.orderId,
    reflection: params.reflection ?? "",
    instruction: order?.instruction ?? order?.title ?? "",
    failureCategory: params.failureCategory,
  });

  if (!gap) return { routed: false };

  return activateAcademyPath({
    userId: params.userId,
    blueprintId: params.blueprintId,
    orderId: params.orderId,
    gap,
  });
}

export async function activateAcademyPath(params: {
  userId: string;
  blueprintId: string;
  orderId: string;
  gap: CapabilityGap;
}): Promise<{ routed: boolean; learningPathId?: string; orderId?: string }> {
  const { learningPathId, orderId } = await generateLearningPath({
    gap: params.gap,
    userId: params.userId,
    blueprintId: params.blueprintId,
  });

  await logCapabilityGap({
    userId: params.userId,
    blueprintId: params.blueprintId,
    orderId: params.orderId,
    gap: params.gap,
    learningPathId,
  });

  logger.info(
    { userId: params.userId, learningPathId, orderId, skill: params.gap.skillCategory },
    "[Academy] Capability gap routed",
  );

  return { routed: true, learningPathId, orderId };
}
