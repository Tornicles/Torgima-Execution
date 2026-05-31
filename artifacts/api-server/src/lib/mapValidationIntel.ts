import type { validations } from "@workspace/db";
import { enrichedFromValidationRow, mapCompetitorsForApi } from "./enrichedValidationIntel.js";

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
  return mapCompetitorsForApi(enrichedFromValidationRow(row).competitors) as Array<Record<string, unknown>>;
}

export function pathsFromValidationRow(row: ValidationRow): Record<string, unknown> {
  const intel = intelligenceFromRow(row);
  const pathsCol = (row as ValidationRow & { paths?: unknown }).paths as Record<string, unknown> | null;
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
