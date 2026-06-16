import { eq } from "drizzle-orm";
import { db, erectorIntakeSessions, erectorUserRealityProfiles } from "@workspace/db";
import type {
  AmbiguityResult,
  ContradictionResult,
  IntakeTier,
  MissingFieldResult,
  NormalizedIntake,
} from "./types.js";
import { hasCriticalMissingFields } from "./MissingFieldDetector.js";

export type UserRealityProfileBuildResult = {
  profile_id: string;
  validation_ready: boolean;
};

function structuredGoal(normalized: NormalizedIntake): string {
  return (
    normalized.what_building?.trim() ||
    normalized.desired_outcome?.trim() ||
    normalized.industry?.trim() ||
    "Intake goal pending clarification"
  );
}

function ambiguityFlagStrings(ambiguity: AmbiguityResult): string[] {
  return ambiguity.ambiguity_flags.map(
    (flag) => `${flag.field}:${flag.detected_issue}`,
  );
}

function contradictionFlagStrings(contradictions: ContradictionResult): string[] {
  return contradictions.contradictions.map((c) => c.type);
}

function missingFieldStrings(missing: MissingFieldResult): string[] {
  return missing.missing_fields.map((m) => m.field);
}

export function computeValidationReady(
  tier: IntakeTier,
  missing: MissingFieldResult,
  contradictions: ContradictionResult,
): boolean {
  if (hasCriticalMissingFields(missing)) return false;
  if (contradictions.contradiction_score >= 70) return false;
  if (tier !== "free" && missing.has_missing_required) return false;
  return true;
}

export async function buildUserRealityProfile(
  userId: string,
  sessionId: string,
  tier: IntakeTier,
  normalized: NormalizedIntake,
  missingFields: MissingFieldResult,
  ambiguity: AmbiguityResult,
  contradictions: ContradictionResult,
): Promise<UserRealityProfileBuildResult> {
  const validation_ready = computeValidationReady(tier, missingFields, contradictions);
  const missing = missingFieldStrings(missingFields);
  const ambiguityFlags = ambiguityFlagStrings(ambiguity);
  const contradictionFlags = contradictionFlagStrings(contradictions);

  const [existing] = await db
    .select({ id: erectorUserRealityProfiles.id })
    .from(erectorUserRealityProfiles)
    .where(eq(erectorUserRealityProfiles.intake_session_id, sessionId))
    .limit(1);

  const profileValues = {
    user_id: userId,
    intake_session_id: sessionId,
    structured_goal: structuredGoal(normalized),
    goal_measurable_outcome: normalized.desired_outcome,
    structured_purpose: {
      why_it_matters: normalized.why_it_matters,
      problem_solved: normalized.problem_solved,
      target_who: normalized.target_who,
      differentiation: normalized.differentiation,
    },
    industry: normalized.industry,
    location: normalized.location,
    market_scope: normalized.market_scope,
    operating_context: normalized.operating_context,
    revenue_model: normalized.revenue_model,
    price_range: normalized.price_range,
    business_type: normalized.revenue_type,
    budget_range: normalized.budget_range,
    budget_usd_estimate: normalized.budget_usd_estimate,
    hours_per_week: normalized.hours_per_week,
    team_size: normalized.team_size,
    skills_present: normalized.skills_present,
    skills_missing: normalized.skills_missing,
    timeline_launch: normalized.timeline_launch,
    timeline_customers: normalized.timeline_customers,
    timeline_final: normalized.timeline_final,
    known_blockers: normalized.known_blockers,
    prior_attempts: normalized.prior_attempts,
    regulatory_flags: normalized.regulatory_flags,
    success_30_days: normalized.success_30_days,
    success_90_days: normalized.success_90_days,
    success_12_months: normalized.success_12_months,
    payment_infrastructure: normalized.payment_infrastructure,
    market_maturity: normalized.market_maturity,
    internet_reliability: normalized.internet_reliability,
    updated_at: new Date(),
  };

  let profile_id: string;
  if (existing) {
    const [updated] = await db
      .update(erectorUserRealityProfiles)
      .set(profileValues)
      .where(eq(erectorUserRealityProfiles.id, existing.id))
      .returning({ id: erectorUserRealityProfiles.id });
    profile_id = updated?.id ?? existing.id;
  } else {
    const [inserted] = await db
      .insert(erectorUserRealityProfiles)
      .values(profileValues)
      .returning({ id: erectorUserRealityProfiles.id });
    if (!inserted) throw new Error("Failed to create erector_user_reality_profiles row");
    profile_id = inserted.id;
  }

  await db
    .update(erectorIntakeSessions)
    .set({
      normalized_payload: normalized,
      missing_fields: missing,
      ambiguity_flags: ambiguityFlags,
      contradiction_flags: contradictionFlags,
      validation_ready,
      last_saved_at: new Date(),
    })
    .where(eq(erectorIntakeSessions.id, sessionId));

  return { profile_id, validation_ready };
}
