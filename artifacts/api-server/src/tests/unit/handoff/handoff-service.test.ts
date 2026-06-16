import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  HANDOFF_TOKEN_TTL_MS,
  buildHandoffPayload,
  consumeHandoffToken,
  createHandoffToken,
  hashToken,
  isValidHandoffPath,
} from "../../../services/handoff-service.js";
import { TorgimaError } from "../../../lib/errors.js";

vi.mock("../../../services/DashboardService.js", () => ({
  invalidateDashboardCache: vi.fn(),
}));

const handoffRows: Array<Record<string, unknown>> = [];
const freeRows: Array<Record<string, unknown>> = [];
const paidRows: Array<Record<string, unknown>> = [];
const intakeRows: Array<Record<string, unknown>> = [];
const userRows = [{ id: "user-1", dashboard_mode: "limited" }];

function chain(result: unknown) {
  const c = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(Array.isArray(result) ? result : [result]),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(Array.isArray(result) ? result : [result]),
    values: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  };
  return c;
}

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => chain([])),
    insert: vi.fn(() => chain([{ id: "handoff-1" }])),
    update: vi.fn(() => chain([{ id: "updated" }])),
  },
  erectorFreeValidations: { id: "id", handoff_token_id: "handoff_token_id" },
  erectorPaidValidations: { id: "id", user_id: "user_id", intake_json: "intake_json", report_json: "report_json" },
  erectorIntakeSessions: { id: "id", user_id: "user_id", handoff_token_id: "handoff_token_id" },
  handoffTokens: { id: "id", token_hash: "token_hash", expires_at: "expires_at", consumed: "consumed" },
  users: { id: "id", dashboard_mode: "dashboard_mode" },
}));

import { db } from "@workspace/db";

describe("handoff-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handoffRows.length = 0;
    freeRows.length = 0;
    paidRows.length = 0;
    intakeRows.length = 0;
  });

  it("validates upgrade paths", () => {
    expect(isValidHandoffPath("pro", "torgima")).toBe(true);
    expect(isValidHandoffPath("free", "pro" as const)).toBe(true);
    expect(isValidHandoffPath("free", "torgima")).toBe(true);
    expect(isValidHandoffPath("pro", "pro" as never)).toBe(false);
  });

  it("hashes tokens deterministically", async () => {
    const a = await hashToken("token-abc");
    const b = await hashToken("token-abc");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("uses a 30-day token ttl", () => {
    expect(HANDOFF_TOKEN_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("builds free handoff payload from validation", async () => {
    vi.mocked(db.select).mockReturnValue(
      chain([
        {
          id: "free-1",
          industry: "SaaS",
          location: "Canada",
          budget_range: "1k_5k",
          timeline: "3_months",
          additional_context: "B2B tool",
          report_json: { verdict: "adjust" },
        },
      ]) as never,
    );

    const payload = await buildHandoffPayload("free", "free-1");
    expect(payload.industry).toBe("SaaS");
    expect(payload.location).toBe("Canada");
    expect(payload.section_3_data).toMatchObject({ location: "Canada", prefilled_from_handoff: true });
  });

  it("rejects consume for missing or expired token", async () => {
    vi.mocked(db.select).mockReturnValue(chain([]) as never);
    await expect(consumeHandoffToken("missing-token", "user-1")).rejects.toBeInstanceOf(TorgimaError);
  });

  it("marks token consumed and returns prefill for pro handoff", async () => {
    const tokenRaw = "11111111-1111-1111-1111-111111111111";
    const tokenHash = await hashToken(tokenRaw);
    const tokenRow = {
      id: "handoff-1",
      source_tier: "pro",
      target_tier: "torgima",
      data_json: { industry: "Retail", location: "US" },
      consumed: false,
      expires_at: new Date(Date.now() + 60_000),
      token_hash: tokenHash,
    };

    vi.mocked(db.select)
      .mockReturnValueOnce(chain([tokenRow]) as never)
      .mockReturnValueOnce(chain([]) as never);
    const updateChain = chain([{ id: "handoff-1" }]);
    vi.mocked(db.update).mockReturnValue(updateChain as never);
    vi.mocked(db.insert).mockReturnValue(chain([{ id: "intake-1" }]) as never);

    const result = await consumeHandoffToken(tokenRaw, "user-1");
    expect(result.prefill).toMatchObject({ industry: "Retail" });
    expect(result.intake_skip).toBe(true);
    expect(updateChain.set).toHaveBeenCalled();
  });

  it("defers consumption for free handoff until intake session is created", async () => {
    const tokenRaw = "33333333-3333-3333-3333-333333333333";
    const tokenHash = await hashToken(tokenRaw);
    const tokenRow = {
      id: "handoff-free",
      source_tier: "free",
      target_tier: "torgima",
      data_json: { industry: "Retail", location: "US" },
      consumed: false,
      expires_at: new Date(Date.now() + 60_000),
      token_hash: tokenHash,
    };

    vi.mocked(db.select).mockReturnValue(chain([tokenRow]) as never);
    const updateChain = chain([{ id: "handoff-free" }]);
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    const result = await consumeHandoffToken(tokenRaw, "user-1");
    expect(result.prefill).toMatchObject({ industry: "Retail" });
    expect(updateChain.set).not.toHaveBeenCalled();
  });

  it("rejects consume for already-consumed token", async () => {
    vi.mocked(db.select).mockReturnValue(chain([]) as never);
    await expect(consumeHandoffToken("used-token", "user-1")).rejects.toMatchObject({
      message: "HANDOFF_TOKEN_INVALID_OR_EXPIRED",
    });
  });

  it("builds pro handoff payload with all intake sections", async () => {
    const intake = {
      section_1_data: { projectName: "Acme" },
      section_2_data: { who: "Founders" },
      section_3_data: { location: "US" },
      section_4_data: { revenueModel: "SaaS" },
      section_5_data: { budget: "10k" },
      section_6_data: { launchDate: "2026-07-01" },
      section_7_data: { blockers: "Time" },
      section_8_data: { success30Days: "MVP" },
    };
    vi.mocked(db.select).mockReturnValue(
      chain([
        {
          id: "paid-1",
          intake_json: intake,
          report_json: { verdict: "proceed", validation_score: 80 },
          project_name: "Acme",
          verdict: "proceed",
          validation_score: 80,
        },
      ]) as never,
    );

    const payload = await buildHandoffPayload("pro", "paid-1");
    expect(payload.section_1_data).toMatchObject({ projectName: "Acme" });
    expect(payload.section_8_data).toMatchObject({ success30Days: "MVP" });
    expect(payload.validation_id).toBe("paid-1");
  });

  it("creates handoff token for free to torgima", async () => {
    vi.mocked(db.select).mockReturnValue(
      chain([
        {
          id: "free-1",
          industry: "Coaching",
          location: "UK",
          budget_range: "under_1k",
          timeline: "1_month",
          additional_context: null,
          report_json: {},
        },
      ]) as never,
    );
    const insertChain = chain([{ id: "handoff-new" }]);
    vi.mocked(db.insert).mockReturnValue(insertChain as never);
    vi.mocked(db.update).mockReturnValue(chain([{}]) as never);

    const created = await createHandoffToken("free", "torgima", "free-1");
    expect(created.token).toBeTruthy();
    expect(created.handoff_id).toBe("handoff-new");
    expect(insertChain.values).toHaveBeenCalled();
  });
});
