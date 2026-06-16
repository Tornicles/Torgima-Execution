import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { blueprints, db, idempotencyRecords } from "@workspace/db";
import { getBlueprintErectorState } from "../engines/erector/erectorStateMachine.js";
import { ObservabilityLayer } from "../engines/erector/ObservabilityLayer.js";
import { success, failure } from "./utils.js";

const validationRequestTimestamps = new Map<string, number[]>();

export function readIdempotencyKey(req: Request): string | null {
  const header =
    req.headers["idempotency-key"] ??
    req.headers["idempotency_key"] ??
    req.headers["x-idempotency-key"];
  if (typeof header === "string" && header.trim()) return header.trim();
  return null;
}

export async function withApiIdempotency(
  scope: string,
  key: string | null,
  handler: () => Promise<{ status: number; body: Record<string, unknown> }>,
): Promise<{ status: number; body: Record<string, unknown>; cached: boolean }> {
  if (!key) {
    const result = await handler();
    return { ...result, cached: false };
  }

  const recordKey = `erector_api:${scope}:${key}`;
  const [existing] = await db
    .select({ result: idempotencyRecords.result })
    .from(idempotencyRecords)
    .where(eq(idempotencyRecords.key, recordKey))
    .limit(1);

  if (existing?.result) {
    return {
      status: 200,
      body: existing.result as Record<string, unknown>,
      cached: true,
    };
  }

  const result = await handler();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db
    .insert(idempotencyRecords)
    .values({
      key: recordKey,
      result: result.body,
      expires_at: expiresAt,
    })
    .onConflictDoNothing();

  return { ...result, cached: false };
}

export function checkValidationRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxRequests = 10;
  const prior = (validationRequestTimestamps.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (prior.length >= maxRequests) {
    validationRequestTimestamps.set(userId, prior);
    return false;
  }
  prior.push(now);
  validationRequestTimestamps.set(userId, prior);
  return true;
}

export async function resolveErectorState(blueprintId?: string | null): Promise<string> {
  if (!blueprintId) return "not_started";
  return getBlueprintErectorState(blueprintId);
}

export async function logErectorApiCall(input: {
  runType: string;
  runId: string;
  userId: string;
  blueprintId?: string | null;
  latencyMs: number;
  resultSummary: Record<string, unknown>;
  verdictIssued?: string;
}): Promise<void> {
  await ObservabilityLayer.logRun({
    run_type: input.runType,
    run_id: input.runId,
    userId: input.userId,
    blueprintId: input.blueprintId ?? undefined,
    latency_ms: input.latencyMs,
    verdict_issued: input.verdictIssued,
    result_summary: input.resultSummary,
  });
}

export async function erectorSuccess(
  res: Response,
  data: unknown,
  opts: {
    status?: number;
    message?: string;
    blueprintId?: string | null;
  } = {},
): Promise<void> {
  const erectorState = await resolveErectorState(opts.blueprintId);
  success(
    res,
    {
      data,
      erector_state: erectorState,
      message: opts.message ?? "Request completed.",
    },
    opts.status ?? 200,
  );
}

export function erectorFailure(
  res: Response,
  code: string,
  message: string,
  status = 400,
  erectorState = "not_started",
): void {
  failure(res, code, message, status, {
    detail: JSON.stringify({ erector_state: erectorState, message }),
  });
}

export async function getActiveBlueprintId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: blueprints.id })
    .from(blueprints)
    .where(eq(blueprints.user_id, userId))
    .limit(1);
  return row?.id ?? null;
}

export async function finishErectorApiLog(input: {
  runType: string;
  req: Request;
  userId: string;
  blueprintId?: string | null;
  startedAt: number;
  statusCode: number;
  verdictIssued?: string;
}): Promise<void> {
  await logErectorApiCall({
    runType: input.runType,
    runId: `${input.runType}:${input.req.method}:${input.req.path}:${input.startedAt}`,
    userId: input.userId,
    blueprintId: input.blueprintId,
    latencyMs: Date.now() - input.startedAt,
    resultSummary: {
      method: input.req.method,
      path: input.req.path,
      status_code: input.statusCode,
    },
    verdictIssued: input.verdictIssued,
  });
}
