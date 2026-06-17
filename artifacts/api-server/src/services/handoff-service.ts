/**
 * DOC B4c — Handoff token creation and consumption between Erector tiers.
 */
import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import {
  db,
  erectorFreeValidations,
  erectorIntakeSessions,
  erectorPaidValidations,
  handoffTokens,
  users,
} from "@workspace/db";
import { TorgimaError } from "../lib/errors.js";
import { invalidateDashboardCache } from "./dashboard-cache.js";
import {
  buildHandoffSectionPayload,
  handoffFreeFieldsFromPayload,
} from "./erector/intake/HandoffSectionPrefill.js";
import { readOriginalInputFromReport } from "./erector/free-validation-contract.js";

export type HandoffSourceTier = "free" | "pro";
export type HandoffTargetTier = "pro" | "torgima";

export const HANDOFF_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const VALID_PATHS: Array<[HandoffSourceTier, HandoffTargetTier]> = [
  ["free", "pro"],
  ["free", "torgima"],
  ["pro", "torgima"],
];

export function isValidHandoffPath(
  sourceTier: HandoffSourceTier,
  targetTier: HandoffTargetTier,
): boolean {
  return VALID_PATHS.some(([s, t]) => s === sourceTier && t === targetTier);
}

export async function hashToken(tokenRaw: string): Promise<string> {
  return createHash("sha256").update(tokenRaw).digest("hex");
}

function sectionKey(n: number): `section_${number}_data` {
  return `section_${n}_data` as `section_${number}_data`;
}

function completedSectionsFromPayload(data: Record<string, unknown>): number[] {
  const completed: number[] = [];
  for (let i = 1; i <= 8; i++) {
    const value = data[sectionKey(i)];
    if (value && typeof value === "object" && Object.keys(value as object).length > 0) {
      completed.push(i);
    }
  }
  return completed;
}

export async function buildHandoffPayload(
  sourceTier: HandoffSourceTier,
  validationId: string,
): Promise<Record<string, unknown>> {
  if (sourceTier === "free") {
    const [v] = await db
      .select()
      .from(erectorFreeValidations)
      .where(eq(erectorFreeValidations.id, validationId))
      .limit(1);
    if (!v) throw new TorgimaError("NOT_FOUND", "VALIDATION_NOT_FOUND");

    const originalInput = readOriginalInputFromReport(v.report_json);
    const report =
      v.report_json && typeof v.report_json === "object"
        ? (v.report_json as Record<string, unknown>)
        : {};

    const freeFields = handoffFreeFieldsFromPayload({
      idea_or_goal:
        typeof originalInput?.idea_or_goal === "string" ? originalInput.idea_or_goal : v.industry,
      industry: v.industry,
      industry_or_domain: v.industry,
      location: v.location,
      budget_range: v.budget_range,
      timeline: v.timeline,
      optional_context: v.additional_context,
      additional_context: v.additional_context,
      recommended_direction:
        typeof report.primary_direction === "string"
          ? report.primary_direction
          : typeof report.section_best_direction === "string"
            ? report.section_best_direction
            : null,
      top_risks: Array.isArray(report.top_risks) ? (report.top_risks as string[]) : null,
      top_opportunities: Array.isArray(report.top_strengths) ? (report.top_strengths as string[]) : null,
      market_snapshot:
        typeof report.section_market_reality === "string" ? report.section_market_reality : null,
      execution_snapshot:
        typeof report.section_execution_reality === "string" ? report.section_execution_reality : null,
      free_report_summary: report,
    });
    const sections = buildHandoffSectionPayload(freeFields);

    return {
      original_input: originalInput ?? {
        idea_or_goal: freeFields.idea_or_goal,
        industry_or_domain: v.industry,
        location: v.location,
        budget_range: v.budget_range,
        timeline: v.timeline,
        additional_context: v.additional_context,
      },
      free_report_summary: {
        recommended_direction: freeFields.recommended_direction,
        top_risks: freeFields.top_risks,
        top_opportunities: freeFields.top_opportunities,
        market_snapshot: freeFields.market_snapshot,
        execution_snapshot: freeFields.execution_snapshot,
        verdict: v.verdict,
        validation_score: v.validation_score,
      },
      ...freeFields,
      free_validation_summary: v.report_json,
      free_verdict: v.verdict,
      free_scores: {
        market: null,
        feasibility: null,
        validation_score: v.validation_score,
      },
      created_at: v.created_at?.toISOString?.() ?? new Date().toISOString(),
      ...sections,
    };
  }

  const [v] = await db
    .select()
    .from(erectorPaidValidations)
    .where(eq(erectorPaidValidations.id, validationId))
    .limit(1);
  if (!v) throw new TorgimaError("NOT_FOUND", "VALIDATION_NOT_FOUND");

  const intake = (v.intake_json ?? {}) as Record<string, unknown>;
  return {
    ...intake,
    full_report: v.report_json,
    validation_id: v.id,
    pro_report_summary: v.report_json,
    project_name: v.project_name,
    verdict: v.verdict,
    validation_score: v.validation_score,
  };
}

export type CreateHandoffResult = {
  token: string;
  expires_at: string;
  handoff_id: string;
};

export async function createHandoffToken(
  sourceTier: HandoffSourceTier,
  targetTier: HandoffTargetTier,
  sourceValidationId: string,
  userId?: string,
): Promise<CreateHandoffResult> {
  if (!isValidHandoffPath(sourceTier, targetTier)) {
    throw new TorgimaError("VALIDATION_ERROR", "Invalid handoff path for source and target tier");
  }

  if (sourceTier === "pro") {
    if (!userId) throw new TorgimaError("UNAUTHENTICATED", "Authentication required for Pro handoff");
    const [owned] = await db
      .select({ id: erectorPaidValidations.id })
      .from(erectorPaidValidations)
      .where(
        and(
          eq(erectorPaidValidations.id, sourceValidationId),
          eq(erectorPaidValidations.user_id, userId),
        ),
      )
      .limit(1);
    if (!owned) throw new TorgimaError("NOT_FOUND", "VALIDATION_NOT_FOUND");
  }

  const dataPayload = await buildHandoffPayload(sourceTier, sourceValidationId);
  const tokenRaw = randomUUID();
  const tokenHash = await hashToken(tokenRaw);
  const expiresAt = new Date(Date.now() + HANDOFF_TOKEN_TTL_MS);

  const [row] = await db
    .insert(handoffTokens)
    .values({
      source_tier: sourceTier,
      target_tier: targetTier,
      source_validation_id: sourceValidationId,
      user_id: userId ?? null,
      token_hash: tokenHash,
      data_json: dataPayload,
      expires_at: expiresAt,
    })
    .returning({ id: handoffTokens.id });

  if (!row) throw new TorgimaError("INTERNAL_ERROR", "Failed to create handoff token");

  if (sourceTier === "free") {
    await db
      .update(erectorFreeValidations)
      .set({ handoff_token_id: row.id })
      .where(eq(erectorFreeValidations.id, sourceValidationId));
  }

  return {
    token: tokenRaw,
    expires_at: expiresAt.toISOString(),
    handoff_id: row.id,
  };
}

export type ValidatedHandoffToken = {
  id: string;
  source_tier: string;
  target_tier: string;
  data: Record<string, unknown>;
};

/** Gap Fix 2 — load a handoff token without consuming (for intake session create). */
export async function loadAndValidateHandoffToken(
  tokenRaw: string,
): Promise<ValidatedHandoffToken | null> {
  const tokenHash = await hashToken(tokenRaw);
  const [token] = await db
    .select()
    .from(handoffTokens)
    .where(
      and(
        eq(handoffTokens.token_hash, tokenHash),
        eq(handoffTokens.consumed, false),
        gt(handoffTokens.expires_at, new Date()),
      ),
    )
    .limit(1);

  if (!token) return null;

  return {
    id: token.id,
    source_tier: token.source_tier,
    target_tier: token.target_tier,
    data: (token.data_json ?? {}) as Record<string, unknown>,
  };
}

export async function markHandoffTokenConsumed(tokenId: string, userId: string): Promise<void> {
  await db
    .update(handoffTokens)
    .set({
      consumed: true,
      consumed_at: new Date(),
      consumed_by_user_id: userId,
    })
    .where(eq(handoffTokens.id, tokenId));
}

export function intakePrefillFromHandoffData(
  data: Record<string, unknown>,
): {
  section_1_data: Record<string, unknown>;
  section_3_data: Record<string, unknown>;
  section_5_data: Record<string, unknown>;
  section_6_data: Record<string, unknown>;
  section_7_data: Record<string, unknown>;
  section_8_data: Record<string, unknown>;
  sections_completed: number[];
  current_section: number;
} {
  const hasSectionBlobs =
    data.section_1_data &&
    typeof data.section_1_data === "object" &&
    data.section_3_data &&
    typeof data.section_3_data === "object" &&
    data.section_5_data &&
    typeof data.section_5_data === "object";

  if (hasSectionBlobs) {
    const completed = Array.isArray(data.sections_completed)
      ? (data.sections_completed as number[])
      : [1, 3, 5];
    return {
      section_1_data: data.section_1_data as Record<string, unknown>,
      section_3_data: data.section_3_data as Record<string, unknown>,
      section_5_data: data.section_5_data as Record<string, unknown>,
      section_6_data:
        data.section_6_data && typeof data.section_6_data === "object"
          ? (data.section_6_data as Record<string, unknown>)
          : {},
      section_7_data:
        data.section_7_data && typeof data.section_7_data === "object"
          ? (data.section_7_data as Record<string, unknown>)
          : {},
      section_8_data:
        data.section_8_data && typeof data.section_8_data === "object"
          ? (data.section_8_data as Record<string, unknown>)
          : {},
      sections_completed: completed,
      current_section: typeof data.current_section === "number" ? data.current_section : 2,
    };
  }

  return buildHandoffSectionPayload(handoffFreeFieldsFromPayload(data));
}

async function createPrefilledIntakeFromHandoff(
  userId: string,
  handoffId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const completed = completedSectionsFromPayload(data);
  const allEight = completed.length === 8;

  await db.insert(erectorIntakeSessions).values({
    user_id: userId,
    tier: "authenticated",
    current_section: allEight ? 8 : Math.min(8, (completed.at(-1) ?? 0) + 1),
    sections_completed: completed,
    section_1_data: (data.section_1_data as Record<string, unknown>) ?? {},
    section_2_data: (data.section_2_data as Record<string, unknown>) ?? {},
    section_3_data: (data.section_3_data as Record<string, unknown>) ?? {},
    section_4_data: (data.section_4_data as Record<string, unknown>) ?? {},
    section_5_data: (data.section_5_data as Record<string, unknown>) ?? {},
    section_6_data: (data.section_6_data as Record<string, unknown>) ?? {},
    section_7_data: (data.section_7_data as Record<string, unknown>) ?? {},
    section_8_data: (data.section_8_data as Record<string, unknown>) ?? {},
    prefilled_from_handoff: true,
    handoff_token_id: handoffId,
    status: "in_progress",
  });
}

export type ConsumeHandoffResult = {
  source_tier: string;
  target_tier: string;
  prefill: Record<string, unknown>;
  intake_skip: boolean;
  redirect_to?: string;
  dashboard_mode?: "review" | "limited";
};

export async function consumeHandoffToken(
  tokenRaw: string,
  userId: string,
): Promise<ConsumeHandoffResult> {
  const tokenHash = await hashToken(tokenRaw);
  const [token] = await db
    .select()
    .from(handoffTokens)
    .where(
      and(
        eq(handoffTokens.token_hash, tokenHash),
        eq(handoffTokens.consumed, false),
        gt(handoffTokens.expires_at, new Date()),
      ),
    )
    .limit(1);

  if (!token) {
    throw new TorgimaError("VALIDATION_ERROR", "HANDOFF_TOKEN_INVALID_OR_EXPIRED");
  }

  const data = (token.data_json ?? {}) as Record<string, unknown>;

  const deferConsumption = token.source_tier === "free";

  if (!deferConsumption) {
    await db
      .update(handoffTokens)
      .set({
        consumed: true,
        consumed_at: new Date(),
        consumed_by_user_id: userId,
      })
      .where(eq(handoffTokens.id, token.id));
  }

  const result: ConsumeHandoffResult = {
    source_tier: token.source_tier,
    target_tier: token.target_tier,
    prefill: data,
    intake_skip: false,
  };

  if (token.source_tier === "pro" && token.target_tier === "torgima") {
    const [existing] = await db
      .select({ id: erectorIntakeSessions.id })
      .from(erectorIntakeSessions)
      .where(
        and(
          eq(erectorIntakeSessions.user_id, userId),
          eq(erectorIntakeSessions.handoff_token_id, token.id),
        ),
      )
      .limit(1);

    if (!existing) {
      await createPrefilledIntakeFromHandoff(userId, token.id, data);
    }

    await db.update(users).set({ dashboard_mode: "review" }).where(eq(users.id, userId));
    invalidateDashboardCache(userId);

    result.intake_skip = true;
    result.dashboard_mode = "review";
    result.redirect_to = "/dashboard";
  } else if (token.target_tier === "torgima") {
    result.redirect_to = "/onboarding/intake";
  } else {
    result.redirect_to = "/onboarding/intake?tier=pro";
  }

  return result;
}

export async function getLatestHandoffPrefillForUser(
  userId: string,
): Promise<Record<string, unknown> | null> {
  const [session] = await db
    .select()
    .from(erectorIntakeSessions)
    .where(
      and(
        eq(erectorIntakeSessions.user_id, userId),
        eq(erectorIntakeSessions.prefilled_from_handoff, true),
      ),
    )
    .orderBy(desc(erectorIntakeSessions.started_at))
    .limit(1);

  if (!session) return null;

  return {
    section_1_data: session.section_1_data,
    section_2_data: session.section_2_data,
    section_3_data: session.section_3_data,
    section_4_data: session.section_4_data,
    section_5_data: session.section_5_data,
    section_6_data: session.section_6_data,
    section_7_data: session.section_7_data,
    section_8_data: session.section_8_data,
    intake_session_id: session.id,
  };
}
