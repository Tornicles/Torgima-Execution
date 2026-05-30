/** Normalize validation timeframe fields for DB persistence and finalization. */

export function parseTimeframeDaysFromString(timeframe: string): number | null {
  const trimmed = timeframe.trim();
  if (!trimmed) return null;
  const directDays = trimmed.match(/(\d+)\s*(day|days)/i);
  if (directDays?.[1]) return Number(directDays[1]);
  const weeks = trimmed.match(/(\d+)\s*(week|weeks)/i);
  if (weeks?.[1]) return Number(weeks[1]) * 7;
  const months = trimmed.match(/(\d+)\s*(month|months)/i);
  if (months?.[1]) return Number(months[1]) * 30;
  const years = trimmed.match(/(\d+)\s*(year|years)/i);
  if (years?.[1]) return Number(years[1]) * 365;
  const short = trimmed.match(/^(\d+)d$/i);
  if (short?.[1]) return Number(short[1]);
  const bare = Number(trimmed);
  if (Number.isFinite(bare) && bare > 0) return bare;
  return null;
}

function daysBetween(start: Date, end: Date): number | null {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000)));
}

export function resolveValidationTimeframeFields(input: {
  timeframe?: string | null;
  customTimeframeDays?: number | null;
  timeframeStart?: Date | string | null;
  timeframeEnd?: Date | string | null;
  feedDurationDays?: number | null;
}): { timeframe: string | null; timeframe_days: number | null } {
  let timeframe_days =
    input.customTimeframeDays != null && input.customTimeframeDays > 0
      ? input.customTimeframeDays
      : input.feedDurationDays != null && input.feedDurationDays > 0
        ? input.feedDurationDays
        : null;

  if (timeframe_days == null && input.timeframeStart && input.timeframeEnd) {
    const start = input.timeframeStart instanceof Date ? input.timeframeStart : new Date(input.timeframeStart);
    const end = input.timeframeEnd instanceof Date ? input.timeframeEnd : new Date(input.timeframeEnd);
    timeframe_days = daysBetween(start, end);
  }

  const timeframeStr = input.timeframe?.trim() ?? "";
  if (timeframe_days == null && timeframeStr) {
    timeframe_days = parseTimeframeDaysFromString(timeframeStr);
  }

  const timeframe =
    timeframeStr ||
    (timeframe_days != null ? `${timeframe_days} days` : null);

  return { timeframe, timeframe_days };
}

export function mergeValidationTimeframeFromRow(
  row: {
    timeframe?: string | null;
    timeframe_days?: number | null;
    timeframe_start?: Date | null;
    timeframe_end?: Date | null;
    validation_feed?: unknown;
  },
  blueprint?: { timeframe_days?: number | null } | null,
): { timeframe: string | null; timeframe_days: number | null } {
  const feed = row.validation_feed as { timeframe?: { duration_days?: number } } | null;
  const fromDates = resolveValidationTimeframeFields({
    timeframeStart: row.timeframe_start,
    timeframeEnd: row.timeframe_end,
    feedDurationDays: feed?.timeframe?.duration_days ?? null,
  });

  const timeframe_days =
    row.timeframe_days ?? fromDates.timeframe_days ?? blueprint?.timeframe_days ?? null;
  const timeframe =
    row.timeframe?.trim() ||
    fromDates.timeframe ||
    (timeframe_days != null ? `${timeframe_days} days` : null);

  return { timeframe, timeframe_days };
}
