/**
 * Gap Fix 3 — LIMITED mode dashboard variant detection and context projection.
 */
import { and, desc, eq, or } from "drizzle-orm";
import {
  db,
  erectorFreeValidations,
  erectorIntakeSessions,
  handoffTokens,
  users,
} from "@workspace/db";

export type LimitedDashboardVariant =
  | "post_free_validation"
  | "intake_in_progress"
  | "direct_signup";

export type PostFreeValidationContext = {
  variant: "post_free_validation";
  free_verdict: string;
  free_verdict_label: string;
  market_score: number;
  feasibility_score: number;
  explanation_summary: string;
  handoff_validation_id: string | null;
  upgrade_cta_headline: string;
};

export type IntakeInProgressContext = {
  variant: "intake_in_progress";
  sections_completed: number[];
  sections_total: number;
  current_section: number;
  session_id: string;
  percent_complete: number;
  last_saved: string | null;
  continue_cta: string;
};

export type DirectSignupContext = {
  variant: "direct_signup";
  user_tier: string;
  cta_headline: string;
  cta_body: string;
};

export type LimitedDashboardContext =
  | PostFreeValidationContext
  | IntakeInProgressContext
  | DirectSignupContext;

export function getFreeVerdictLabel(verdict: string): string {
  const v = verdict.toLowerCase();
  if (v === "proceed") return "Good Potential Detected";
  if (v === "adjust") return "Some Gaps to Address";
  return "Key Issues Identified";
}

export function getUpgradeHeadline(verdict: string): string {
  const v = verdict.toLowerCase();
  if (v === "proceed") {
    return "Your project shows real potential. Get your full execution plan.";
  }
  if (v === "adjust") {
    return "A few adjustments could unlock this. Find out exactly what.";
  }
  return "The analysis found something important. Understand it fully before you build.";
}

function readReportSummary(report: unknown): string {
  if (!report || typeof report !== "object") {
    return "Your free preview highlights market potential and resource fit from five quick answers.";
  }
  const row = report as Record<string, unknown>;
  const primary = row.section_recommendation ?? row.primary_direction ?? row.section_market_reality;
  return typeof primary === "string" && primary.trim()
    ? primary.trim().slice(0, 280)
    : "Your free preview highlights market potential and resource fit from five quick answers.";
}

function scoreFromReport(report: unknown, validationScore: number | null): {
  market: number;
  feasibility: number;
} {
  const base = validationScore ?? 50;
  if (!report || typeof report !== "object") {
    return { market: base, feasibility: base };
  }
  const row = report as Record<string, unknown>;
  const preview = row.preview_scores;
  if (preview && typeof preview === "object") {
    const scores = preview as Record<string, unknown>;
    const market = Number(scores.market_viability_score ?? scores.market);
    const feasibility = Number(scores.feasibility_score ?? scores.feasibility);
    return {
      market: Number.isFinite(market) ? market : base,
      feasibility: Number.isFinite(feasibility) ? feasibility : base,
    };
  }
  return { market: base, feasibility: Math.max(20, base - 5) };
}

async function getLatestFreeValidationForUser(userId: string) {
  const [token] = await db
    .select({
      id: handoffTokens.id,
      source_validation_id: handoffTokens.source_validation_id,
      data_json: handoffTokens.data_json,
    })
    .from(handoffTokens)
    .where(
      and(
        eq(handoffTokens.source_tier, "free"),
        or(
          eq(handoffTokens.consumed_by_user_id, userId),
          eq(handoffTokens.user_id, userId),
        ),
      ),
    )
    .orderBy(desc(handoffTokens.created_at))
    .limit(1);

  let validationId = token?.source_validation_id ?? null;

  if (!validationId) {
    const [intake] = await db
      .select({ handoffTokenId: erectorIntakeSessions.handoff_token_id })
      .from(erectorIntakeSessions)
      .where(eq(erectorIntakeSessions.user_id, userId))
      .orderBy(desc(erectorIntakeSessions.started_at))
      .limit(1);

    if (intake?.handoffTokenId) {
      const [linked] = await db
        .select({ source_validation_id: handoffTokens.source_validation_id })
        .from(handoffTokens)
        .where(eq(handoffTokens.id, intake.handoffTokenId))
        .limit(1);
      validationId = linked?.source_validation_id ?? null;
    }
  }

  if (!validationId) return null;

  const [validation] = await db
    .select()
    .from(erectorFreeValidations)
    .where(eq(erectorFreeValidations.id, validationId))
    .limit(1);

  return validation ?? null;
}

async function getActiveIntakeSession(userId: string) {
  const [session] = await db
    .select()
    .from(erectorIntakeSessions)
    .where(and(eq(erectorIntakeSessions.user_id, userId), eq(erectorIntakeSessions.status, "in_progress")))
    .orderBy(desc(erectorIntakeSessions.started_at))
    .limit(1);
  return session ?? null;
}

export async function buildLimitedDashboardContext(userId: string): Promise<{
  limited_variant: LimitedDashboardVariant;
  limited_context: LimitedDashboardContext;
}> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const userTier = user?.tier ?? "starter";

  const latestFreeValidation = await getLatestFreeValidationForUser(userId);
  if (latestFreeValidation?.verdict) {
    const scores = scoreFromReport(
      latestFreeValidation.report_json,
      latestFreeValidation.validation_score,
    );
    const verdict = latestFreeValidation.verdict;
    return {
      limited_variant: "post_free_validation",
      limited_context: {
        variant: "post_free_validation",
        free_verdict: verdict,
        free_verdict_label: getFreeVerdictLabel(verdict),
        market_score: scores.market,
        feasibility_score: scores.feasibility,
        explanation_summary: readReportSummary(latestFreeValidation.report_json),
        handoff_validation_id: latestFreeValidation.id,
        upgrade_cta_headline: getUpgradeHeadline(verdict),
      },
    };
  }

  const activeSession = await getActiveIntakeSession(userId);
  const completed = activeSession?.sections_completed ?? [];
  if (activeSession && completed.length > 0) {
    return {
      limited_variant: "intake_in_progress",
      limited_context: {
        variant: "intake_in_progress",
        sections_completed: completed,
        sections_total: 8,
        current_section: activeSession.current_section,
        session_id: activeSession.id,
        percent_complete: Math.round((completed.length / 8) * 100),
        last_saved: activeSession.last_saved_at?.toISOString() ?? null,
        continue_cta: "Continue your analysis",
      },
    };
  }

  return {
    limited_variant: "direct_signup",
    limited_context: {
      variant: "direct_signup",
      user_tier: userTier,
      cta_headline: "Analyse your project",
      cta_body:
        "Answer 8 questions to receive a full intelligence report before your project launches.",
    },
  };
}
