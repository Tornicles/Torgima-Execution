/**
 * GAP G7 — Zod contracts for API response shapes (LAW 3).
 */

import { z } from "zod";

export const apiSuccessEnvelopeSchema = z.object({
  ok: z.literal(true),
  data: z.unknown().optional(),
  meta: z
    .object({
      timestamp: z.string().optional(),
      requestId: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export const orderFeedbackResultSchema = z.object({
  feedbackId: z.string().uuid(),
  verdictStatus: z.enum(["accepted", "needs_interrogation", "rejected"]),
  weightedScore: z.number(),
  confidence: z.enum(["high", "medium", "low"]),
  requiresInterrogation: z.boolean(),
  interrogationQuestion: z.string().optional(),
  eventId: z.string(),
});

export const orderFeedbackResponseSchema = apiSuccessEnvelopeSchema.extend({
  data: orderFeedbackResultSchema,
});

export const executionFeedbackResultSchema = z
  .object({
    feedbackId: z.string().uuid().optional(),
    queued: z.boolean().optional(),
    nextOrderId: z.string().uuid().optional(),
    requiresInterrogation: z.boolean().optional(),
    interrogationQuestion: z.string().optional(),
    verdictStatus: z.enum(["accepted", "needs_interrogation", "rejected"]).optional(),
  })
  .passthrough();

export const executionFeedbackResponseSchema = apiSuccessEnvelopeSchema.extend({
  data: executionFeedbackResultSchema,
});

export const executionActiveOrderDataSchema = z
  .object({
    order: z.object({ id: z.string().uuid() }).passthrough(),
  })
  .passthrough();

export const executionActiveOrderResponseSchema = apiSuccessEnvelopeSchema.extend({
  data: executionActiveOrderDataSchema,
});

export const dashboardStateResponseSchema = apiSuccessEnvelopeSchema.extend({
  data: z.object({}).passthrough(),
});

export function parseContract<T extends z.ZodType>(
  schema: T,
  body: unknown,
): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `Contract violation: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  return parsed.data;
}
