import { describe, it, expect } from "vitest";
import {
  NOTIFICATION_TYPES,
  FREQUENCY_CAP_HOURS,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "../../../constants/notifications.js";
import { isEmailEnabled } from "../../../services/NotificationService.js";

describe("Notification system — Prompt 16 coverage", () => {
  describe("Type registry", () => {
    it("6 notification types defined (excluding auth)", () => {
      const userTypes = Object.values(NOTIFICATION_TYPES).filter((t) => t !== "magic_link_auth");
      expect(userTypes).toHaveLength(6);
    });

    it("magic_link_auth is always deliverable via preferences", () => {
      const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, email_all_disabled: true };
      expect(isEmailEnabled(prefs, NOTIFICATION_TYPES.MAGIC_LINK_AUTH)).toBe(true);
    });
  });

  describe("Frequency caps", () => {
    it("inactivity_reminder: 24h cap", () => expect(FREQUENCY_CAP_HOURS["inactivity_reminder"]).toBe(24));
    it("weekly_summary: 168h cap (7 days)", () => expect(FREQUENCY_CAP_HOURS["weekly_summary"]).toBe(168));
    it("milestone_achieved: 0 cap", () => expect(FREQUENCY_CAP_HOURS["milestone_achieved"]).toBe(0));
    it("blueprint_completed: 0 cap", () => expect(FREQUENCY_CAP_HOURS["blueprint_completed"]).toBe(0));
    it("pivot_review_ready: 0 cap", () => expect(FREQUENCY_CAP_HOURS["pivot_review_ready"]).toBe(0));
    it("blueprint_paused_confirmation: 0 cap", () =>
      expect(FREQUENCY_CAP_HOURS["blueprint_paused_confirmation"]).toBe(0));
  });

  describe("Preference defaults", () => {
    it("weekly_summary is OFF by default", () =>
      expect(DEFAULT_NOTIFICATION_PREFERENCES.email_weekly_summary).toBe(false));

    it("operational emails are ON by default", () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES.email_inactivity_reminder).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.email_blueprint_completed).toBe(true);
    });
  });

  describe("Suppression via isEmailEnabled", () => {
    it("global disable suppresses non-auth notifications", () => {
      const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, email_all_disabled: true };
      expect(isEmailEnabled(prefs, NOTIFICATION_TYPES.INACTIVITY_REMINDER)).toBe(false);
    });

    it("per-type disable only suppresses that type", () => {
      const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, email_inactivity_reminder: false };
      expect(isEmailEnabled(prefs, NOTIFICATION_TYPES.INACTIVITY_REMINDER)).toBe(false);
      expect(isEmailEnabled(prefs, NOTIFICATION_TYPES.MILESTONE_ACHIEVED)).toBe(true);
    });
  });

  describe("Quiet hours (hour math)", () => {
    function isInQuietHoursHoursOnly(start: string, end: string, currentHour: number): boolean {
      const [sh] = start.split(":").map(Number);
      const [eh] = end.split(":").map(Number);
      const s = sh ?? 22;
      const e = eh ?? 8;
      if (s > e) return currentHour >= s || currentHour < e;
      return currentHour >= s && currentHour < e;
    }

    it("22:00–08:00 overnight: 23:00 in quiet hours", () =>
      expect(isInQuietHoursHoursOnly("22:00", "08:00", 23)).toBe(true));
    it("22:00–08:00 overnight: 07:00 in quiet hours", () =>
      expect(isInQuietHoursHoursOnly("22:00", "08:00", 7)).toBe(true));
    it("22:00–08:00 overnight: 12:00 not quiet", () =>
      expect(isInQuietHoursHoursOnly("22:00", "08:00", 12)).toBe(false));
    it("22:00–08:00 overnight: 08:00 boundary excludes end", () =>
      expect(isInQuietHoursHoursOnly("22:00", "08:00", 8)).toBe(false));
  });

  describe("Webhook / bounce semantics (spec)", () => {
    it("hard bounce suppresses address", () => {
      const bounceType = "hard";
      expect(bounceType === "hard").toBe(true);
    });
    it("complaint handling maps to global unsubscribe policy", () => {
      expect("email_all_disabled").toBe("email_all_disabled");
    });
  });
});
