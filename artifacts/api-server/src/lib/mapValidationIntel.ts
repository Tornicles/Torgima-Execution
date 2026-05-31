import type { validations } from "@workspace/db";

type ValidationRow = typeof validations.$inferSelect;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function competitorListFromUnknown(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const obj = asRecord(raw);
  if (!obj) return [];
  if (Array.isArray(obj.competitors)) return obj.competitors;
  if (Array.isArray(obj.winners)) return obj.winners;
  return [];
}

/** User-submitted purpose — never AI decomposition text. */
export function userPurposeFromRow(row: ValidationRow): string {
  return String(row.raw_purpose ?? row.purpose_final ?? row.purpose ?? "").trim();
}

export function userGoalFromRow(row: ValidationRow): string {
  return String(row.goal_final ?? row.raw_goal ?? "").trim();
}

export function intelligenceFromRow(row: ValidationRow): Record<string, unknown> {
  const payload = (row.intelligence_payload as Record<string, unknown> | null) ?? {};
  const erectorPayload = (row.erector_payload as Record<string, unknown> | null) ?? {};
  return { ...erectorPayload, ...payload };
}

export function competitorsFromValidationRow(row: ValidationRow): Array<Record<string, unknown>> {
  const intel = intelligenceFromRow(row);
  const fromIntel = competitorListFromUnknown(
    intel.competitors ?? intel.primaryCompetitors ?? intel.competitor_analysis ?? intel.competitorAnalysis,
  );
  const fromColumn = competitorListFromUnknown(row.competitor_analysis);
  const merged = fromIntel.length > 0 ? fromIntel : fromColumn;
  const real = merged.filter((c) => {
    const name = String((c as { name?: string }).name ?? "").trim();
    return name.length > 0 && !/ operator \d+$/i.test(name);
  });
  const list = real.slice(0, 3);
  return list.map((c) => {
    const item = c as Record<string, unknown>;
    return {
      name: item.name ?? item.competitorName,
      description: item.description ?? item.summary ?? item.positioningStrategy ?? item.positioning_strategy,
      strengths: item.strengths ?? item.strength_points ?? [],
      weaknesses: item.weaknesses ?? item.weakness_points ?? [],
      marketShare: item.marketShare ?? item.market_share ?? "—",
    };
  });
}

export function pathsFromValidationRow(row: ValidationRow): Record<string, unknown> {
  const intel = intelligenceFromRow(row);
  const pathsCol = row.paths as Record<string, unknown> | null;
  if (pathsCol && typeof pathsCol === "object") return pathsCol;
  return {
    current: intel.paths && typeof intel.paths === "object"
      ? (intel.paths as Record<string, unknown>).current
      : row.path_current,
    adjusted: intel.paths && typeof intel.paths === "object"
      ? (intel.paths as Record<string, unknown>).adjusted
      : row.path_adjusted,
    alternative: intel.paths && typeof intel.paths === "object"
      ? (intel.paths as Record<string, unknown>).alternative
      : row.path_alternative,
  };
}
