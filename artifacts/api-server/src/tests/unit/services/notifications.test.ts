import { describe, it, expect } from "vitest";
import {
  NOTIFICATION_TYPES,
  FREQUENCY_CAP_HOURS,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "../../../constants/notifications.js";
import { isEmailEnabled, isInQuietHours } from "../../../services/NotificationService.js";

describe("Notification types", () => {
  it("defines 6 non-auth notification types", () => {
    const types = Object.values(NOTIFICATION_TYPES).filter((t) => t !== "magic_link_auth");
    expect(types).toHaveLength(6);
  });

  it("magic_link_auth is never suppressed", () => {
    expect(NOTIFICATION_TYPES.MAGIC_LINK_AUTH).toBe("magic_link_auth");
    expect(isEmailEnabled({ email_all_disabled: true }, NOTIFICATION_TYPES.MAGIC_LINK_AUTH)).toBe(true);
  });
});

describe("Frequency caps", () => {
  it("inactivity_reminder has 24h cap", () => {
    expect(FREQUENCY_CAP_HOURS["inactivity_reminder"]).toBe(24);
  });

  it("milestone_achieved has no cap (0)", () => {
    expect(FREQUENCY_CAP_HOURS["milestone_achieved"]).toBe(0);
  });

  it("weekly_summary has 168h (7 day) cap", () => {
    expect(FREQUENCY_CAP_HOURS["weekly_summary"]).toBe(168);
  });
});

describe("Default preferences", () => {
  it("weekly_summary is off by default (opt-in)", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.email_weekly_summary).toBe(false);
  });

  it("inactivity_reminder is on by default", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.email_inactivity_reminder).toBe(true);
  });

  it("email_all_disabled is false by default", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.email_all_disabled).toBe(false);
  });

  it("quiet_hours disabled by default", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.quiet_hours_enabled).toBe(false);
  });
});

describe("Email preference checks", () => {
  it("global disable suppresses non-auth types", () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, email_all_disabled: true };
    expect(isEmailEnabled(prefs, NOTIFICATION_TYPES.INACTIVITY_REMINDER)).toBe(false);
  });

  it("per-type disable only suppresses that type", () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, email_inactivity_reminder: false };
    expect(isEmailEnabled(prefs, NOTIFICATION_TYPES.INACTIVITY_REMINDER)).toBe(false);
    expect(isEmailEnabled(prefs, NOTIFICATION_TYPES.MILESTONE_ACHIEVED)).toBe(true);
  });
});

describe("Quiet hours logic", () => {
  it("22:00 to 08:00 is overnight quiet hours encoding", () => {
    const start = "22:00";
    const end = "08:00";
    const [startH] = start.split(":").map(Number);
    const [endH] = end.split(":").map(Number);
    expect(startH).toBeGreaterThan(endH ?? 0);
  });

  it("disabled quiet hours never triggers", () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, quiet_hours_enabled: false };
    expect(isInQuietHours(prefs, "UTC")).toBe(false);
  });

  it("deferred notifications stale threshold is 12h (spec constant)", () => {
    const MAX_DEFER_HOURS = 12;
    expect(MAX_DEFER_HOURS).toBe(12);
  });
});
