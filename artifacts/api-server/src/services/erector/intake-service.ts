/**
 * DOC B4b — Erector 8-section intake session management.
 */
import { randomUUID } from "node:crypto";
import { and, eq, type InferSelectModel } from "drizzle-orm";
import {
  db,
  erectorIntakeSessions,
  erectorPaidValidations,
} from "@workspace/db";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import { getFallback } from "../../bhudhi/FallbackLibrary.js";
import type { ErectorPaidOutput } from "../../bhudhi/schemas/erector-schemas.js";
import { TorgimaError } from "../../lib/errors.js";
import { feedErectorToBlueprint } from "./blueprint-feed-service.js";
import { runIntakePipeline } from "./intake/IntakePipeline.js";
import type { IntakePipelineResult } from "./intake/types.js";
import {
  intakePrefillFromHandoffData,
  loadAndValidateHandoffToken,
  markHandoffTokenConsumed,
} from "../handoff-service.js";

export type IntakeTier = "pro" | "authenticated";

export type IntakeSessionRow = InferSelectModel<typeof erectorIntakeSessions>;

const SECTION_COLUMNS = [
  "section_1_data",
  "section_2_data",
  "section_3_data",
  "section_4_data",
  "section_5_data",
  "section_6_data",
  "section_7_data",
  "section_8_data",
  "section_9_data",
] as const;

export function serializeIntakeSession(row: IntakeSessionRow) {
  return {
    id: row.id,
    blueprint_id: row.blueprint_id,
    tier: row.tier,
    status: row.status,
    current_section: row.current_section,
    sections_completed: row.sections_completed ?? [],
    section_1_data: row.section_1_data,
    section_2_data: row.section_2_data,
    section_3_data: row.section_3_data,
    section_4_data: row.section_4_data,
    section_5_data: row.section_5_data,
    section_6_data: row.section_6_data,
    section_7_data: row.section_7_data,
    section_8_data: row.section_8_data,
    section_9_data: row.section_9_data ?? null,
    validation_id: row.validation_id,
    prefilled_from_handoff: row.prefilled_from_handoff,
    started_at: row.started_at,
    completed_at: row.completed_at,
    last_saved_at: row.last_saved_at,
    completion_percentage: row.completion_percentage ?? 0,
    missing_fields: row.missing_fields ?? [],
    ambiguity_flags: row.ambiguity_flags ?? [],
    contradiction_flags: row.contradiction_flags ?? [],
    required_missing_fields: row.required_missing_fields ?? [],
    submitted_at: row.submitted_at ?? null,
    baseline_requested_at: row.baseline_requested_at ?? null,
    baseline_completed_at: row.baseline_completed_at ?? null,
    baseline_failed_at: row.baseline_failed_at ?? null,
  };
}

export async function createIntakeSession(
  userId: string,
  tier: IntakeTier,
  handoffToken?: string,
  blueprintId?: string,
): Promise<IntakeSessionRow> {
  if (blueprintId) {
    const [existing] = await db
      .select()
      .from(erectorIntakeSessions)
      .where(
        and(
          eq(erectorIntakeSessions.user_id, userId),
          eq(erectorIntakeSessions.blueprint_id, blueprintId),
          eq(erectorIntakeSessions.status, "in_progress"),
        ),
      )
      .limit(1);
    if (existing) return existing;
  }

  const baseValues = {
    user_id: userId,
    blueprint_id: blueprintId ?? null,
    tier,
    current_section: 1,
    sections_completed: [] as number[],
    status: "in_progress" as const,
    prefilled_from_handoff: false,
    handoff_token_id: null as string | null,
  };

  let insertValues: typeof erectorIntakeSessions.$inferInsert = { ...baseValues };

  if (handoffToken?.trim()) {
    const token = await loadAndValidateHandoffToken(handoffToken.trim());
    if (token && token.source_tier === "free") {
      const prefill = intakePrefillFromHandoffData(token.data);
      insertValues = {
        ...baseValues,
        prefilled_from_handoff: true,
        handoff_token_id: token.id,
        current_section: prefill.current_section,
        sections_completed: prefill.sections_completed,
        section_1_data: prefill.section_1_data,
        section_3_data: prefill.section_3_data,
        section_5_data: prefill.section_5_data,
        section_6_data: prefill.section_6_data,
        section_7_data: prefill.section_7_data,
        section_8_data: prefill.section_8_data,
      };
      await markHandoffTokenConsumed(token.id, userId);
    }
  }

  const [row] = await db
    .insert(erectorIntakeSessions)
    .values(insertValues)
    .returning();
  if (!row) throw new TorgimaError("INTERNAL_ERROR", "Failed to create intake session");
  return row;
}

export async function getIntakeSessionForUser(
  sessionId: string,
  userId: string,
): Promise<IntakeSessionRow | null> {
  const [row] = await db
    .select()
    .from(erectorIntakeSessions)
    .where(and(eq(erectorIntakeSessions.id, sessionId), eq(erectorIntakeSessions.user_id, userId)))
    .limit(1);
  return row ?? null;
}

export async function saveIntakeSection(
  sessionId: string,
  userId: string,
  section: number,
  data: Record<string, unknown>,
): Promise<IntakeSessionRow> {
  if (section < 1 || section > 9) {
    throw new TorgimaError("VALIDATION_ERROR", "Section must be between 1 and 9");
  }

  const existing = await getIntakeSessionForUser(sessionId, userId);
  if (!existing) throw new TorgimaError("NOT_FOUND", "Intake session not found");
  if (existing.status === "completed") {
    throw new TorgimaError("VALIDATION_ERROR", "Intake session is already completed");
  }

  const column = SECTION_COLUMNS[section - 1]!;
  const completed = new Set(existing.sections_completed ?? []);
  completed.add(section);
  const nextSection = Math.min(9, Math.max(existing.current_section, section + 1));
  const completionPct = Math.round((completed.size / 9) * 100);

  const [row] = await db
    .update(erectorIntakeSessions)
    .set({
      [column]: data,
      sections_completed: [...completed],
      current_section: nextSection,
      completion_percentage: completionPct,
      last_saved_at: new Date(),
    })
    .where(eq(erectorIntakeSessions.id, sessionId))
    .returning();

  if (!row) throw new TorgimaError("INTERNAL_ERROR", "Failed to save intake section");
  return row;
}

function sectionFacts(row: IntakeSessionRow): Record<string, unknown> {
  return {
    section_1_data: row.section_1_data ?? {},
    section_2_data: row.section_2_data ?? {},
    section_3_data: row.section_3_data ?? {},
    section_4_data: row.section_4_data ?? {},
    section_5_data: row.section_5_data ?? {},
    section_6_data: row.section_6_data ?? {},
    section_7_data: row.section_7_data ?? {},
    section_8_data: row.section_8_data ?? {},
    stateVersion: 0,
  };
}

export async function runErectorPaidBhudhi(
  userId: string,
  sessionId: string,
  row: IntakeSessionRow,
): Promise<{ data: ErectorPaidOutput; fallbackUsed: boolean }> {
  const facts = sectionFacts(row);
  try {
    const result = await routeBhudhiRequest<ErectorPaidOutput>({
      sourceEngine: "erector_paid",
      triggerType: "ERECTOR_PAID_VALIDATION",
      userId,
      stateVersion: 0,
      requestedMode: "STRUCTURE",
      idempotencyKey: `erector-paid:${sessionId}:${randomUUID()}`,
      facts,
    });
    if (result.ok && result.output?.data && typeof result.output.data === "object") {
      return { data: result.output.data as ErectorPaidOutput, fallbackUsed: result.fallbackUsed };
    }
  } catch {
    // deterministic fallback below
  }
  const envelope = getFallback("ERECTOR_PAID_FALLBACK", facts, 0);
  return { data: envelope.data as ErectorPaidOutput, fallbackUsed: true };
}

function readSection<T extends Record<string, unknown>>(value: unknown): T {
  return value && typeof value === "object" ? (value as T) : ({} as T);
}

function mapPaidValidationInsert(
  userId: string,
  tier: string,
  row: IntakeSessionRow,
  report: ErectorPaidOutput,
  intakeJson: Record<string, unknown>,
) {
  const s1 = readSection<Record<string, string>>(row.section_1_data);
  const s2 = readSection<Record<string, string>>(row.section_2_data);
  const s3 = readSection<Record<string, string>>(row.section_3_data);
  const s4 = readSection<Record<string, string>>(row.section_4_data);
  const s5 = readSection<Record<string, unknown>>(row.section_5_data);
  const s6 = readSection<Record<string, string>>(row.section_6_data);
  const s8 = readSection<Record<string, string>>(row.section_8_data);

  const skillsPresent = Array.isArray(s5.skillsPresent)
    ? (s5.skillsPresent as string[])
    : typeof s5.skillsPresent === "string"
      ? s5.skillsPresent.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const skillsMissing = Array.isArray(s5.skillsMissing)
    ? (s5.skillsMissing as string[])
    : typeof s5.skillsMissing === "string"
      ? s5.skillsMissing.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  return {
    user_id: userId,
    tier,
    intake_json: intakeJson,
    project_name: s1.projectName ?? s1.project_name ?? null,
    verdict: report.verdict,
    selected_path: report.selected_path,
    goal_structured: report.goal_structured,
    purpose_structured: report.purpose_structured,
    industry: s3.location ?? s3.industry ?? null,
    location: s3.location ?? null,
    business_type: s1.whatBuilding ?? s1.what_building ?? null,
    revenue_model: s4.revenueModel ?? s4.revenue_model ?? null,
    budget_range: String(s5.budget ?? s5.budget_range ?? ""),
    hours_per_week: Number(s5.hoursPerWeek ?? s5.hours_per_week ?? 0) || null,
    team_size: Number(s5.teamSize ?? s5.team_size ?? 1) || 1,
    skills_present: skillsPresent,
    skills_missing: skillsMissing,
    timeline_launch: s6.launchDate ?? s6.launch_date ?? null,
    timeline_customers: s6.firstCustomersDate ?? s6.first_customers_date ?? null,
    timeline_final: s6.finalTargetDate ?? s6.final_target_date ?? null,
    success_30_days: s8.success30Days ?? s8.success_30_days ?? null,
    success_90_days: s8.success90Days ?? s8.success_90_days ?? null,
    success_12_months: s8.success12Months ?? s8.success_12_months ?? null,
    risk_flags: report.risk_flags,
    policy_rules: report.policy_rules,
    winning_conditions: report.winning_conditions,
    failure_conditions: report.failure_conditions,
    validation_score: report.validation_score,
    report_json: report,
    status: "complete",
    completed_at: new Date(),
  };
}

export type CompleteIntakeSuccess = {
  validation_ready: true;
  validation_id: string;
  report: ErectorPaidOutput;
  tier: string;
  blueprint_id?: string;
  dashboard_mode?: "full";
  redirect_to?: string;
  profile_id: string;
  contradiction_score: number;
};

export type CompleteIntakeNeedsClarification = IntakePipelineResult & {
  validation_ready: false;
  tier: string;
};

export type CompleteIntakeResult = CompleteIntakeSuccess | CompleteIntakeNeedsClarification;

/**
 * Prompt 6: validate-only result (do not unlock execution; used by /validate + /submit).
 */
export type ValidateIntakeResult = {
  status: "in_progress" | "needs_review" | "complete";
  completion_percentage: number;
  completed_sections: number;
  total_sections: number;
  missing_required_fields: string[];
  contradictions: IntakePipelineResult["contradiction_score"];
  ambiguity_flags: IntakePipelineResult["ambiguity_flags"];
  can_submit: boolean;
};

export async function completeIntakeSession(
  sessionId: string,
  userId: string,
): Promise<CompleteIntakeResult> {
  const row = await getIntakeSessionForUser(sessionId, userId);
  if (!row) throw new TorgimaError("NOT_FOUND", "Intake session not found");

  const completed = row.sections_completed ?? [];
  if (completed.length < 9) {
    throw new TorgimaError(
      "VALIDATION_ERROR",
      `Complete all 9 intake sections before analysis (${completed.length}/9 saved)`,
    );
  }

  if (row.validation_id) {
    const [existingPaid] = await db
      .select()
      .from(erectorPaidValidations)
      .where(eq(erectorPaidValidations.id, row.validation_id))
      .limit(1);
    if (existingPaid?.report_json) {
      return {
        validation_ready: true,
        validation_id: existingPaid.id,
        report: existingPaid.report_json as ErectorPaidOutput,
        tier: row.tier,
        blueprint_id: existingPaid.blueprint_id ?? undefined,
        profile_id: "",
        contradiction_score: 0,
      };
    }
  }

  const pipelineResult = await runIntakePipeline(sessionId, userId);
  if (!pipelineResult.validation_ready) {
    // Persist pipeline diagnostics onto the session (Prompt 6).
    const missing = pipelineResult.missing_fields.map((m) => String(m.field));
    const ambiguity = pipelineResult.ambiguity_flags.map((a) => `${a.field}:${a.detected_issue}`);
    await db
      .update(erectorIntakeSessions)
      .set({
        required_missing_fields: missing,
        missing_fields: missing,
        ambiguity_flags: ambiguity,
        contradiction_flags: [],
        validation_ready: false,
        status: pipelineResult.contradiction_score >= 70 || missing.length > 0 ? "needs_review" : "in_progress",
        last_saved_at: new Date(),
      })
      .where(eq(erectorIntakeSessions.id, sessionId))
      .catch(() => null);
    return {
      ...pipelineResult,
      validation_ready: false,
      tier: row.tier,
    };
  }

  const bhudhi = await runErectorPaidBhudhi(userId, sessionId, row);
  const intakeJson = sectionFacts(row);

  const [paidRow] = await db
    .insert(erectorPaidValidations)
    .values(mapPaidValidationInsert(userId, row.tier, row, bhudhi.data, intakeJson))
    .returning();

  if (!paidRow) throw new TorgimaError("INTERNAL_ERROR", "Failed to persist paid validation");

  await db
    .update(erectorIntakeSessions)
    .set({
      status: "completed",
      validation_id: paidRow.id,
      completed_at: new Date(),
      last_saved_at: new Date(),
      submitted_at: new Date(),
      baseline_requested_at: new Date(),
    })
    .where(eq(erectorIntakeSessions.id, sessionId));

  const result: CompleteIntakeSuccess = {
    validation_ready: true,
    validation_id: paidRow.id,
    report: bhudhi.data,
    tier: row.tier,
    profile_id: pipelineResult.profile_id,
    contradiction_score: pipelineResult.contradiction_score,
  };

  // Prompt 6: do NOT unlock full execution here. Baseline generation is triggered by event loop.
  // Keep redirect to dashboard for authenticated tier.
  if (row.tier === "authenticated") {
    result.redirect_to = "/dashboard";
  } else {
    result.redirect_to = `/onboarding/intake/report/${paidRow.id}`;
  }

  return result;
}
