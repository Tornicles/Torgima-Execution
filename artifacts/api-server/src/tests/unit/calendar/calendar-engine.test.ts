/**
 * PROMPT 3 — Calendar conflict detection & slots.
 */

import { describe, it, expect } from "vitest";
import {
  CALENDAR_VIEWS,
  EVENT_COLORS,
  rangesOverlap,
} from "../../../engines/calendar/CalendarEngine.js";
import { FEATURE_FLAGS, isFeatureEnabledByDefault } from "../../../constants/feature-flags.js";

describe("Calendar overlap logic", () => {
  it("detects overlapping intervals", () => {
    const aStart = new Date("2026-05-21T10:00:00Z");
    const aEnd = new Date("2026-05-21T11:00:00Z");
    const bStart = new Date("2026-05-21T10:30:00Z");
    const bEnd = new Date("2026-05-21T12:00:00Z");
    expect(rangesOverlap(aStart, aEnd, bStart, bEnd)).toBe(true);
  });

  it("allows adjacent non-overlapping intervals", () => {
    const aStart = new Date("2026-05-21T10:00:00Z");
    const aEnd = new Date("2026-05-21T11:00:00Z");
    const bStart = new Date("2026-05-21T11:00:00Z");
    const bEnd = new Date("2026-05-21T12:00:00Z");
    expect(rangesOverlap(aStart, aEnd, bStart, bEnd)).toBe(false);
  });
});

describe("Calendar constants", () => {
  it("exposes eight view types", () => {
    expect(CALENDAR_VIEWS).toHaveLength(8);
    expect(CALENDAR_VIEWS).toContain("kanban");
    expect(CALENDAR_VIEWS).toContain("map");
  });

  it("maps event types to colors", () => {
    expect(EVENT_COLORS.order).toBe("#3b82f6");
    expect(EVENT_COLORS.study).toBe("#22c55e");
    expect(EVENT_COLORS["principle-deadline"]).toBe("#a855f7");
  });

  it("calendar_enabled is on by default in phase 1", () => {
    expect(FEATURE_FLAGS.CALENDAR_ENABLED).toBe("calendar_enabled");
    expect(isFeatureEnabledByDefault(FEATURE_FLAGS.CALENDAR_ENABLED)).toBe(true);
  });
});
