import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildLimitedDashboardContext,
  getFreeVerdictLabel,
  getUpgradeHeadline,
} from "../../../services/limited-dashboard-context.js";

const handoffRows: Array<Record<string, unknown>> = [];
const intakeRows: Array<Record<string, unknown>> = [];
const freeRows: Array<Record<string, unknown>> = [];

function chain(result: unknown) {
  const c = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(Array.isArray(result) ? result : [result]),
  };
  return c;
}

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => chain([])),
  },
  users: { id: "id", tier: "tier" },
  handoffTokens: { id: "id", source_tier: "source_tier", source_validation_id: "source_validation_id" },
  erectorFreeValidations: { id: "id", verdict: "verdict" },
  erectorIntakeSessions: { id: "id", status: "status" },
}));

import { db } from "@workspace/db";

describe("limited-dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handoffRows.length = 0;
    intakeRows.length = 0;
    freeRows.length = 0;
  });

  it("maps free verdict to customer language labels", () => {
    expect(getFreeVerdictLabel("proceed")).toBe("Good Potential Detected");
    expect(getFreeVerdictLabel("adjust")).toBe("Some Gaps to Address");
    expect(getFreeVerdictLabel("pivot")).toBe("Key Issues Identified");
    expect(getUpgradeHeadline("proceed")).toContain("real potential");
  });

  it("selects post_free_validation when user has a free validation verdict", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(
        chain([{ id: "user-1", tier: "starter" }]) as never,
      )
      .mockReturnValueOnce(
        chain([
          {
            id: "handoff-1",
            source_validation_id: "free-1",
            data_json: {},
          },
        ]) as never,
      )
      .mockReturnValueOnce(
        chain([
          {
            id: "free-1",
            verdict: "proceed",
            validation_score: 62,
            report_json: { section_recommendation: "Strong local demand signals." },
          },
        ]) as never,
      );

    const result = await buildLimitedDashboardContext("user-1");
    expect(result.limited_variant).toBe("post_free_validation");
    expect(result.limited_context.variant).toBe("post_free_validation");
    if (result.limited_context.variant === "post_free_validation") {
      expect(result.limited_context.free_verdict_label).toBe("Good Potential Detected");
      expect(result.limited_context.market_score).toBeGreaterThan(0);
    }
  });

  it("selects intake_in_progress when session has completed sections", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(chain([{ id: "user-1", tier: "starter" }]) as never)
      .mockReturnValueOnce(chain([]) as never)
      .mockReturnValueOnce(chain([]) as never)
      .mockReturnValueOnce(
        chain([
          {
            id: "sess-1",
            status: "in_progress",
            sections_completed: [1, 2],
            current_section: 3,
            last_saved_at: new Date("2026-06-01T12:00:00Z"),
          },
        ]) as never,
      );

    const result = await buildLimitedDashboardContext("user-1");
    expect(result.limited_variant).toBe("intake_in_progress");
    if (result.limited_context.variant === "intake_in_progress") {
      expect(result.limited_context.percent_complete).toBe(25);
      expect(result.limited_context.sections_completed).toEqual([1, 2]);
    }
  });

  it("selects direct_signup when no validation or intake exists", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(chain([{ id: "user-1", tier: "starter" }]) as never)
      .mockReturnValueOnce(chain([]) as never)
      .mockReturnValueOnce(chain([]) as never)
      .mockReturnValueOnce(chain([]) as never);

    const result = await buildLimitedDashboardContext("user-1");
    expect(result.limited_variant).toBe("direct_signup");
    if (result.limited_context.variant === "direct_signup") {
      expect(result.limited_context.cta_headline).toBe("Analyse your project");
    }
  });

  it("variant components avoid internal verdict tokens in customer copy", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const root = resolve(process.cwd(), "../torgima");
    const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");
    const html = [
      read("src/components/dashboard/LimitedDashboard/VariantA_PostFreeValidation.tsx"),
      read("src/components/dashboard/LimitedDashboard/VariantB_DirectSignup.tsx"),
      read("src/components/dashboard/LimitedDashboard/VariantC_IntakeInProgress.tsx"),
    ].join("\n");
    expect(html).not.toMatch(/\bPROCEED\b|\bADJUST\b|\bPIVOT\b|erector_state/);
    expect(html).not.toContain("blueprint");
  });
});
