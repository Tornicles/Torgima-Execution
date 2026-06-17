/**
 * DOC B4 — Public Erector Free validation (no auth).
 */
import { Router } from "express";
import { db, erectorFreeValidations } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import { getFallback } from "../../bhudhi/FallbackLibrary.js";
import type { ErectorFreeOutput } from "../../bhudhi/schemas/erector-schemas.js";
import { success, failure, handleError } from "../../lib/utils.js";
import { createHandoffToken } from "../../services/handoff-service.js";
import { ObservabilityLayer } from "../../engines/erector/ObservabilityLayer.js";
import {
  FREE_VALIDATION_LIMIT,
  IP_VALIDATION_LIMIT,
  SESSION_VALIDATION_LIMIT,
  buildFreeValidationResult,
  countFreeValidationsByFingerprint,
  countFreeValidationsByIpHash,
  countFreeValidationsBySession,
  hashIpAddress,
  parseBhudhiFreeOutput,
  parseFreeValidateBody,
  wrapStoredReport,
  type NormalizedFreeValidateInput,
} from "../../services/erector/free-validation-contract.js";

export {
  FREE_VALIDATION_LIMIT,
  countFreeValidationsByFingerprint,
  erectorFreeValidateBodySchema,
} from "../../services/erector/free-validation-contract.js";

export const PUBLIC_ERECTOR_USER_ID = "00000000-0000-0000-0000-000000000000";

export type ErectorFreeValidateBody = NormalizedFreeValidateInput;

export async function runErectorFreeBhudhi(
  input: NormalizedFreeValidateInput,
): Promise<{ data: ErectorFreeOutput; fallbackUsed: boolean }> {
  const facts = {
    idea_or_goal: input.idea_or_goal,
    industry: input.industry_or_domain,
    industry_or_domain: input.industry_or_domain,
    location: input.location,
    budget_range: input.budget_range,
    timeline: input.timeline,
    additional_context: input.additional_context ?? "",
    stateVersion: 0,
  };

  try {
    const result = await routeBhudhiRequest<ErectorFreeOutput>({
      sourceEngine: "erector_free",
      triggerType: "ERECTOR_FREE_VALIDATION",
      userId: PUBLIC_ERECTOR_USER_ID,
      stateVersion: 0,
      requestedMode: "INTERPRET",
      idempotencyKey: `erector-free:${input.fingerprint}:${randomUUID()}`,
      facts,
    });

    if (result.ok && result.output?.data) {
      const parsed = parseBhudhiFreeOutput(result.output.data);
      if (parsed) {
        return { data: parsed, fallbackUsed: result.fallbackUsed };
      }
    }
  } catch {
    // fall through to deterministic fallback
  }

  const envelope = getFallback("ERECTOR_FREE_FALLBACK", facts, 0);
  return {
    data: envelope.data as ErectorFreeOutput,
    fallbackUsed: true,
  };
}

function resolveClientIp(req: { ip?: string; headers: Record<string, unknown> }): string | undefined {
  if (typeof req.ip === "string" && req.ip.trim()) return req.ip.trim();
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim();
  return undefined;
}

const router = Router();

// POST /api/erector/free/validate — public, no auth
router.post("/free/validate", async (req, res) => {
  const started = Date.now();
  try {
    const parsed = parseFreeValidateBody(req.body);
    if (!parsed.ok) {
      failure(res, "VALIDATION_ERROR", "Please complete all required fields.", 400, {
        fieldErrors: parsed.fieldErrors,
      });
      return;
    }

    const input = parsed.data;
    const ipHash = hashIpAddress(resolveClientIp(req));

    const [fingerprintCount, ipCount, sessionCount] = await Promise.all([
      countFreeValidationsByFingerprint(input.fingerprint),
      ipHash ? countFreeValidationsByIpHash(ipHash) : Promise.resolve(0),
      countFreeValidationsBySession(input.anonymous_session_id),
    ]);

    if (
      fingerprintCount >= FREE_VALIDATION_LIMIT ||
      (ipHash && ipCount >= IP_VALIDATION_LIMIT) ||
      sessionCount >= SESSION_VALIDATION_LIMIT
    ) {
      await ObservabilityLayer.logRun({
        run_type: "free_validation_rate_limited",
        run_id: input.fingerprint,
        latency_ms: Date.now() - started,
        result_summary: {
          event: "free_validation_failed",
          reason: "rate_limited",
          fingerprint_count: fingerprintCount,
          ip_count: ipCount,
          session_count: sessionCount,
        },
      });
      failure(
        res,
        "FREE_VALIDATION_LIMIT_REACHED",
        "You have used your free validations. Create an account to continue with the full Project Intelligence Intake.",
        429,
        {
          detail: JSON.stringify({ upgrade_url: "/upgrade" }),
        },
      );
      return;
    }

    await ObservabilityLayer.logRun({
      run_type: "free_validation_requested",
      run_id: input.fingerprint,
      latency_ms: 0,
      result_summary: { event: "free_validation_requested" },
    });

    const bhudhiResult = await runErectorFreeBhudhi(input);

    const [validation] = await db
      .insert(erectorFreeValidations)
      .values({
        fingerprint: input.fingerprint,
        ip_address: ipHash,
        industry: input.industry_or_domain,
        location: input.location,
        budget_range: input.budget_range,
        timeline: input.timeline,
        additional_context: input.additional_context?.trim() || null,
        report_json: wrapStoredReport(bhudhiResult.data, input, {
          ip_hash: ipHash,
          anonymous_session_id: input.anonymous_session_id,
        }),
        verdict: bhudhiResult.data.verdict,
        validation_score: bhudhiResult.data.validation_score,
      })
      .returning({ id: erectorFreeValidations.id });

    const remainingFree = Math.max(0, FREE_VALIDATION_LIMIT - (fingerprintCount + 1));

    let handoff_token: string | undefined;
    let handoff_expires_at: string | undefined;
    if (validation?.id) {
      try {
        const handoff = await createHandoffToken("free", "torgima", validation.id);
        handoff_token = handoff.token;
        handoff_expires_at = handoff.expires_at;
        await ObservabilityLayer.logRun({
          run_type: "free_handoff_token_created",
          run_id: validation.id,
          latency_ms: Date.now() - started,
          result_summary: {
            event: "free_handoff_token_created",
            validation_id: validation.id,
          },
        });
      } catch {
        // handoff is best-effort — validation still succeeds
      }
    }

    const result = buildFreeValidationResult({
      validationId: validation?.id ?? "",
      input,
      bhudhi: bhudhiResult.data,
      remainingFree,
      handoffToken: handoff_token,
      handoffExpiresAt: handoff_expires_at,
      fallbackUsed: bhudhiResult.fallbackUsed,
    });

    await ObservabilityLayer.logRun({
      run_type: "free_validation_completed",
      run_id: validation?.id ?? input.fingerprint,
      latency_ms: Date.now() - started,
      verdict_issued: bhudhiResult.data.verdict,
      bhudhi_called: !bhudhiResult.fallbackUsed,
      bhudhi_fallback_used: bhudhiResult.fallbackUsed,
      result_summary: {
        event: "free_validation_completed",
        validation_id: validation?.id,
        fallback_used: bhudhiResult.fallbackUsed,
        remaining_free: remainingFree,
      },
    });

    success(res, result);
  } catch (err) {
    await ObservabilityLayer.logRun({
      run_type: "free_validation_failed",
      run_id: "unknown",
      latency_ms: Date.now() - started,
      result_summary: {
        event: "free_validation_failed",
        reason: err instanceof Error ? err.message : "unknown",
      },
    });
    handleError(req, res, err);
  }
});

// GET /api/erector/free/report/:id — public JSON report
router.get("/free/report/:id", async (req, res) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) {
      failure(res, "VALIDATION_ERROR", "Validation id required", 400);
      return;
    }

    const [row] = await db
      .select()
      .from(erectorFreeValidations)
      .where(eq(erectorFreeValidations.id, id))
      .limit(1);

    if (!row) {
      failure(res, "NOT_FOUND", "Report not found", 404);
      return;
    }

    const fingerprint =
      typeof req.query.fingerprint === "string" ? req.query.fingerprint.trim() : undefined;
    if (fingerprint && row.fingerprint !== fingerprint) {
      failure(res, "NOT_FOUND", "Report not found", 404);
      return;
    }

    const bhudhi = parseBhudhiFreeOutput(row.report_json) ?? (row.report_json as ErectorFreeOutput);
    const originalInput = (row.report_json as Record<string, unknown>)?._meta as
      | { original_input?: NormalizedFreeValidateInput }
      | undefined;

    const input: NormalizedFreeValidateInput = originalInput?.original_input ?? {
      idea_or_goal: row.additional_context ?? row.industry,
      industry_or_domain: row.industry,
      location: row.location,
      budget_range: row.budget_range,
      timeline: row.timeline,
      additional_context: row.additional_context ?? undefined,
      fingerprint: row.fingerprint,
      anonymous_session_id: row.fingerprint,
    };

    const payload = buildFreeValidationResult({
      validationId: row.id,
      input,
      bhudhi,
      remainingFree: 0,
    });

    success(res, {
      ...payload,
      created_at: row.created_at,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/erector/free/validation/:id/handoff-token — public, fingerprint-gated
router.post("/free/validation/:id/handoff-token", async (req, res) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) {
      failure(res, "VALIDATION_ERROR", "Validation id required", 400);
      return;
    }

    const fingerprint =
      typeof req.body?.fingerprint === "string" ? req.body.fingerprint.trim() : undefined;
    if (!fingerprint) {
      failure(res, "VALIDATION_ERROR", "Fingerprint required", 400);
      return;
    }

    const [row] = await db
      .select()
      .from(erectorFreeValidations)
      .where(eq(erectorFreeValidations.id, id))
      .limit(1);

    if (!row || row.fingerprint !== fingerprint) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }

    if (row.handoff_token_id) {
      failure(res, "VALIDATION_ERROR", "Handoff token already generated for this validation", 409);
      return;
    }

    const handoff = await createHandoffToken("free", "torgima", id);
    success(res, {
      handoff_token: handoff.token,
      expires_at: handoff.expires_at,
      handoff_id: handoff.handoff_id,
      upgrade_url: `/upgrade?handoff=${handoff.token}`,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
