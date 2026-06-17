/**
 * Gap Fix 2 — map free-tier handoff fields into paid intake section payloads (Prompt 6 + 7).
 */

export type HandoffFreeFields = {
  idea_or_goal?: string | null;
  industry?: string | null;
  industry_or_domain?: string | null;
  location?: string | null;
  budget_range?: string | null;
  timeline?: string | null;
  optional_context?: string | null;
  additional_context?: string | null;
  recommended_direction?: string | null;
  top_risks?: string[] | null;
  top_opportunities?: string[] | null;
  market_snapshot?: string | null;
  execution_snapshot?: string | null;
};

export const HANDOFF_PREFILLED_SECTIONS = [1, 3, 5, 6, 7, 8] as const;

function readIndustry(token: HandoffFreeFields): string {
  return (token.industry_or_domain ?? token.industry ?? "").trim();
}

function readIdea(token: HandoffFreeFields): string {
  return (token.idea_or_goal ?? readIndustry(token)).trim();
}

function readNotes(token: HandoffFreeFields): string {
  return (token.additional_context ?? token.optional_context ?? "").trim();
}

export function handoffFreeFieldsFromPayload(data: Record<string, unknown>): HandoffFreeFields {
  const original =
    data.original_input && typeof data.original_input === "object"
      ? (data.original_input as Record<string, unknown>)
      : null;

  const reportSummary =
    data.free_report_summary && typeof data.free_report_summary === "object"
      ? (data.free_report_summary as Record<string, unknown>)
      : data.free_validation_summary && typeof data.free_validation_summary === "object"
        ? (data.free_validation_summary as Record<string, unknown>)
        : null;

  const topRisks = Array.isArray(data.top_risks)
    ? (data.top_risks as string[])
    : Array.isArray(reportSummary?.top_risks)
      ? (reportSummary.top_risks as string[])
      : null;

  const topOpportunities = Array.isArray(data.top_opportunities)
    ? (data.top_opportunities as string[])
    : Array.isArray(reportSummary?.top_strengths)
      ? (reportSummary.top_strengths as string[])
      : null;

  return {
    idea_or_goal:
      typeof data.idea_or_goal === "string"
        ? data.idea_or_goal
        : typeof original?.idea_or_goal === "string"
          ? original.idea_or_goal
          : null,
    industry:
      typeof data.industry === "string"
        ? data.industry
        : typeof original?.industry_or_domain === "string"
          ? original.industry_or_domain
          : null,
    industry_or_domain:
      typeof data.industry_or_domain === "string"
        ? data.industry_or_domain
        : typeof original?.industry_or_domain === "string"
          ? original.industry_or_domain
          : typeof data.industry === "string"
            ? data.industry
            : null,
    location:
      typeof data.location === "string"
        ? data.location
        : typeof original?.location === "string"
          ? original.location
          : null,
    budget_range:
      typeof data.budget_range === "string"
        ? data.budget_range
        : typeof original?.budget_range === "string"
          ? original.budget_range
          : null,
    timeline:
      typeof data.timeline === "string"
        ? data.timeline
        : typeof original?.timeline === "string"
          ? original.timeline
          : null,
    optional_context:
      typeof data.optional_context === "string"
        ? data.optional_context
        : typeof data.additional_context === "string"
          ? data.additional_context
          : typeof original?.additional_context === "string"
            ? original.additional_context
            : null,
    additional_context:
      typeof data.additional_context === "string" ? data.additional_context : null,
    recommended_direction:
      typeof data.recommended_direction === "string"
        ? data.recommended_direction
        : typeof reportSummary?.primary_direction === "string"
          ? reportSummary.primary_direction
          : typeof reportSummary?.section_best_direction === "string"
            ? reportSummary.section_best_direction
            : null,
    top_risks: topRisks,
    top_opportunities: topOpportunities,
    market_snapshot:
      typeof data.market_snapshot === "string"
        ? data.market_snapshot
        : typeof reportSummary?.section_market_reality === "string"
          ? reportSummary.section_market_reality
          : null,
    execution_snapshot:
      typeof data.execution_snapshot === "string"
        ? data.execution_snapshot
        : typeof reportSummary?.section_execution_reality === "string"
          ? reportSummary.section_execution_reality
          : null,
  };
}

export function buildSection1FromHandoff(token: HandoffFreeFields): Record<string, unknown> {
  const idea = readIdea(token);
  const industry = readIndustry(token);
  const notes = readNotes(token);

  return {
    project_name: industry || idea.slice(0, 80),
    project_description: idea,
    primary_goal: idea,
    project_purpose: notes || `Explore ${industry || "this direction"} with a validated wedge.`,
    success_definition: "",
    failure_definition: "",
    prefilled_from_handoff: true,
  };
}

export function buildSection3FromHandoff(token: HandoffFreeFields): Record<string, unknown> {
  const industry = readIndustry(token);
  return {
    location: token.location ?? "",
    market_scope: industry,
    competitors: "",
    market_saturation_estimate: token.market_snapshot?.slice(0, 500) ?? "",
    differentiation: token.recommended_direction?.slice(0, 500) ?? "",
    market_gap: (token.top_opportunities ?? []).slice(0, 3).join("; "),
    timing_reason: token.timeline ?? "",
    prefilled_from_handoff: true,
  };
}

export function buildSection5FromHandoff(token: HandoffFreeFields): Record<string, unknown> {
  return {
    budget: token.budget_range ?? "",
    weekly_hours: "",
    existing_skills: "",
    missing_skills: "",
    team_status: "solo",
    available_assets: "",
    available_tools: "",
    current_audience_or_customers: "",
    prefilled_from_handoff: true,
  };
}

export function buildSection6FromHandoff(token: HandoffFreeFields): Record<string, unknown> {
  return {
    launch_target_date: token.timeline ?? "",
    first_result_date: "",
    thirty_day_target: "",
    ninety_day_target: "",
    twelve_month_target: "",
    work_availability: readNotes(token),
    commitment_level: "",
    prefilled_from_handoff: true,
  };
}

export function buildSection7FromHandoff(token: HandoffFreeFields): Record<string, unknown> {
  const risks = (token.top_risks ?? []).slice(0, 5).join("; ");
  return {
    known_risks: risks,
    legal_constraints: "",
    technical_constraints: token.execution_snapshot?.slice(0, 300) ?? "",
    financial_constraints: token.budget_range ?? "",
    time_constraints: token.timeline ?? "",
    skill_constraints: "",
    external_dependencies: "",
    past_attempts: "",
    past_failures: "",
    unknowns: "",
    prefilled_from_handoff: true,
  };
}

export function buildSection8FromHandoff(token: HandoffFreeFields): Record<string, unknown> {
  return {
    strategy_preference: token.recommended_direction ?? "",
    non_negotiables: "",
    avoid_work_types: "",
    repeatable_work_types: "",
    minimum_success_threshold: "",
    prefilled_from_handoff: true,
  };
}

export function buildHandoffSectionPayload(token: HandoffFreeFields): {
  section_1_data: Record<string, unknown>;
  section_3_data: Record<string, unknown>;
  section_5_data: Record<string, unknown>;
  section_6_data: Record<string, unknown>;
  section_7_data: Record<string, unknown>;
  section_8_data: Record<string, unknown>;
  sections_completed: number[];
  current_section: number;
} {
  const sections_completed = [...HANDOFF_PREFILLED_SECTIONS];
  return {
    section_1_data: buildSection1FromHandoff(token),
    section_3_data: buildSection3FromHandoff(token),
    section_5_data: buildSection5FromHandoff(token),
    section_6_data: buildSection6FromHandoff(token),
    section_7_data: buildSection7FromHandoff(token),
    section_8_data: buildSection8FromHandoff(token),
    sections_completed,
    current_section: 2,
  };
}

export function nextUnfilledIntakeSection(sectionsCompleted: number[]): number {
  for (let section = 1; section <= 9; section += 1) {
    if (!sectionsCompleted.includes(section)) return section;
  }
  return 9;
}
