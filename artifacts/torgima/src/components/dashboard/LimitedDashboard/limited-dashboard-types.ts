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

export type LimitedDashboardUser = {
  id: string;
  email: string;
  tier: string;
};

export type LimitedDashboardPayload = {
  mode: "limited" | "review";
  user: LimitedDashboardUser;
  message: string;
  limited_variant: LimitedDashboardVariant;
  limited_context: LimitedDashboardContext;
  preview?: {
    projectName?: string | null;
    goal?: string | null;
    blueprintTier?: string | null;
    validationSummary?: string | null;
  };
};

export function isLimitedDashboardPayload(data: unknown): data is LimitedDashboardPayload {
  if (!data || typeof data !== "object") return false;
  const row = data as { mode?: string };
  return row.mode === "limited" || row.mode === "review";
}

export function normalizeLimitedDashboardPayload(data: unknown): LimitedDashboardPayload | null {
  if (!isLimitedDashboardPayload(data)) return null;
  const row = data as Partial<LimitedDashboardPayload>;
  if (!row.user) return null;

  const variant =
    row.limited_variant ??
    (row.preview?.validationSummary ? "post_free_validation" : "direct_signup");

  return {
    mode: row.mode ?? "limited",
    user: row.user,
    message: row.message ?? "Complete Project Intelligence to activate your project",
    limited_variant: variant,
    limited_context: row.limited_context ?? fallbackLimitedContext(variant),
    preview: row.preview,
  };
}

export function fallbackLimitedContext(
  variant: LimitedDashboardVariant = "direct_signup",
): LimitedDashboardContext {
  if (variant === "post_free_validation") {
    return {
      variant: "post_free_validation",
      free_verdict: "adjust",
      free_verdict_label: "Some Gaps to Address",
      market_score: 55,
      feasibility_score: 50,
      explanation_summary: "Your free preview is ready. Upgrade for the full intelligence report.",
      handoff_validation_id: null,
      upgrade_cta_headline:
        "A few adjustments could unlock this. Find out exactly what.",
    };
  }
  if (variant === "intake_in_progress") {
    return {
      variant: "intake_in_progress",
      sections_completed: [1, 2],
      sections_total: 8,
      current_section: 3,
      session_id: "local",
      percent_complete: 25,
      last_saved: null,
      continue_cta: "Continue your analysis",
    };
  }
  return {
    variant: "direct_signup",
    user_tier: "starter",
    cta_headline: "Analyse your project",
    cta_body:
      "Answer 8 questions to receive a full intelligence report before your project launches.",
  };
}
