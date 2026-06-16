/**
 * Gap Fix 2 — map free-tier handoff fields into intake section payloads.
 */

export type HandoffFreeFields = {
  industry?: string | null;
  location?: string | null;
  budget_range?: string | null;
  timeline?: string | null;
  optional_context?: string | null;
  additional_context?: string | null;
};

export const HANDOFF_PREFILLED_SECTIONS = [1, 3, 5] as const;

export function handoffFreeFieldsFromPayload(data: Record<string, unknown>): HandoffFreeFields {
  return {
    industry: typeof data.industry === "string" ? data.industry : null,
    location: typeof data.location === "string" ? data.location : null,
    budget_range: typeof data.budget_range === "string" ? data.budget_range : null,
    timeline: typeof data.timeline === "string" ? data.timeline : null,
    optional_context:
      typeof data.optional_context === "string"
        ? data.optional_context
        : typeof data.additional_context === "string"
          ? data.additional_context
          : null,
    additional_context: typeof data.additional_context === "string" ? data.additional_context : null,
  };
}

export function buildSection1FromHandoff(token: HandoffFreeFields): Record<string, unknown> {
  const industry = token.industry?.trim() || null;
  const optional =
    token.optional_context?.trim() || token.additional_context?.trim() || null;

  return {
    projectName: industry ?? "",
    whatBuilding: industry ? `Building in the ${industry} space` : "",
    whyItMatters: optional ?? "",
    desiredOutcome: "",
    prefilled_from_handoff: true,
  };
}

export function buildSection3FromHandoff(token: HandoffFreeFields): Record<string, unknown> {
  return {
    location: token.location ?? "",
    industry: token.industry ?? "",
    scope: "",
    competitors: "",
    differentiation: "",
    prefilled_from_handoff: true,
  };
}

export function buildSection5FromHandoff(token: HandoffFreeFields): Record<string, unknown> {
  return {
    budget: token.budget_range ?? "",
    budget_range: token.budget_range ?? "",
    hoursPerWeek: "",
    teamSize: "1",
    skillsPresent: "",
    skillsMissing: "",
    prefilled_from_handoff: true,
  };
}

export function buildHandoffSectionPayload(token: HandoffFreeFields): {
  section_1_data: Record<string, unknown>;
  section_3_data: Record<string, unknown>;
  section_5_data: Record<string, unknown>;
  sections_completed: number[];
  current_section: number;
} {
  return {
    section_1_data: buildSection1FromHandoff(token),
    section_3_data: buildSection3FromHandoff(token),
    section_5_data: buildSection5FromHandoff(token),
    sections_completed: [...HANDOFF_PREFILLED_SECTIONS],
    current_section: 2,
  };
}

export function nextUnfilledIntakeSection(sectionsCompleted: number[]): number {
  for (let section = 1; section <= 8; section += 1) {
    if (!sectionsCompleted.includes(section)) return section;
  }
  return 8;
}
