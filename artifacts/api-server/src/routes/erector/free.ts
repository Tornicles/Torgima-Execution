/**
 * DOC B4 — Public Erector Free validation (no auth).
 */
import { Router } from "express";
import { z } from "zod/v4";
import { db, erectorFreeValidations } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import { getFallback } from "../../bhudhi/FallbackLibrary.js";
import type { ErectorFreeOutput } from "../../bhudhi/schemas/erector-schemas.js";
import { success, failure, handleError } from "../../lib/utils.js";
import { createHandoffToken } from "../../services/handoff-service.js";

export const FREE_VALIDATION_LIMIT = 3;
export const PUBLIC_ERECTOR_USER_ID = "00000000-0000-0000-0000-000000000000";

export const erectorFreeValidateBodySchema = z.object({
  industry: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(120),
  budget_range: z.enum(["under_1k", "1k_5k", "5k_20k", "20k_plus"]),
  timeline: z.enum(["1_month", "3_months", "6_months", "12_months_plus"]),
  additional_context: z.string().max(500).optional(),
  fingerprint: z.string().trim().min(8).max(128),
});

export type ErectorFreeValidateBody = z.infer<typeof erectorFreeValidateBodySchema>;

export async function countFreeValidationsByFingerprint(fingerprint: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(erectorFreeValidations)
    .where(eq(erectorFreeValidations.fingerprint, fingerprint));
  return Number(row?.count ?? 0);
}

export async function runErectorFreeBhudhi(
  input: ErectorFreeValidateBody,
): Promise<{ data: ErectorFreeOutput; fallbackUsed: boolean }> {
  const facts = {
    industry: input.industry,
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

    if (result.ok && result.output?.data && typeof result.output.data === "object") {
      return {
        data: result.output.data as ErectorFreeOutput,
        fallbackUsed: result.fallbackUsed,
      };
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

const router = Router();

// POST /api/erector/free/validate — public, no auth
router.post("/free/validate", async (req, res) => {
  try {
    const parsed = erectorFreeValidateBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Please complete all required fields.", 400, {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      });
      return;
    }

    const { fingerprint } = parsed.data;
    const existingCount = await countFreeValidationsByFingerprint(fingerprint);
    if (existingCount >= FREE_VALIDATION_LIMIT) {
      failure(res, "LIMIT_REACHED", "You've used your 3 free checks. Ready to go deeper?", 429, {
        detail: JSON.stringify({ upgrade_required: true, remaining_free: 0, upgrade_url: "/upgrade" }),
      });
      return;
    }

    const bhudhiResult = await runErectorFreeBhudhi(parsed.data);
    const ipAddress =
      typeof req.ip === "string"
        ? req.ip
        : typeof req.headers["x-forwarded-for"] === "string"
          ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
          : undefined;

    const [validation] = await db
      .insert(erectorFreeValidations)
      .values({
        fingerprint,
        ip_address: ipAddress,
        industry: parsed.data.industry,
        location: parsed.data.location,
        budget_range: parsed.data.budget_range,
        timeline: parsed.data.timeline,
        additional_context: parsed.data.additional_context?.trim() || null,
        report_json: bhudhiResult.data,
        verdict: bhudhiResult.data.verdict,
        validation_score: bhudhiResult.data.validation_score,
      })
      .returning({ id: erectorFreeValidations.id });

    const remainingFree = Math.max(0, FREE_VALIDATION_LIMIT - (existingCount + 1));

    let handoff_token: string | undefined;
    let handoff_expires_at: string | undefined;
    if (validation?.id) {
      try {
        const handoff = await createHandoffToken("free", "torgima", validation.id);
        handoff_token = handoff.token;
        handoff_expires_at = handoff.expires_at;
      } catch {
        // handoff is best-effort — validation still succeeds
      }
    }

    success(res, {
      validation_id: validation?.id,
      report: bhudhiResult.data,
      remaining_free: remainingFree,
      upgrade_url: "/upgrade",
      fallback_used: bhudhiResult.fallbackUsed,
      handoff_token,
      handoff_expires_at,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/erector/free/report/:id — public report by validation id (optional fingerprint gate)
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

    success(res, {
      validation_id: row.id,
      report: row.report_json,
      verdict: row.verdict,
      validation_score: row.validation_score,
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
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
