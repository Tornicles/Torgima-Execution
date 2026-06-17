import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildHandoffSectionPayload,
  buildSection1FromHandoff,
  buildSection3FromHandoff,
  buildSection5FromHandoff,
} from "../../../services/erector/intake/HandoffSectionPrefill.js";
import { createIntakeSession } from "../../../services/erector/intake-service.js";
import {
  createHandoffToken,
  hashToken,
  intakePrefillFromHandoffData,
  loadAndValidateHandoffToken,
} from "../../../services/handoff-service.js";

vi.mock("../../../services/dashboard-cache.js", () => ({
  invalidateDashboardCache: vi.fn(),
}));

const intakeRows: Array<Record<string, unknown>> = [];
const handoffRows: Array<Record<string, unknown>> = [];

function chain(result: unknown) {
  const c = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(Array.isArray(result) ? result : [result]),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockImplementation(() => {
      if (Array.isArray(result)) return Promise.resolve(result);
      return Promise.resolve([result]);
    }),
    values: vi.fn().mockImplementation((row: Record<string, unknown>) => {
      intakeRows.push(row);
      return c;
    }),
  };
  return c;
}

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => chain([])),
    insert: vi.fn(() => chain([{ id: "session-1", tier: "authenticated", status: "in_progress" }])),
    update: vi.fn(() => chain([{ id: "updated" }])),
  },
  erectorFreeValidations: { id: "id", handoff_token_id: "handoff_token_id" },
  erectorPaidValidations: { id: "id" },
  erectorIntakeSessions: { id: "id" },
  handoffTokens: { id: "id", token_hash: "token_hash", expires_at: "expires_at", consumed: "consumed" },
  users: { id: "id" },
}));

import { db } from "@workspace/db";

const freeTokenFields = {
  idea_or_goal: "Build a B2B SaaS wedge for retailers",
  industry: "tech",
  industry_or_domain: "tech",
  location: "Lagos Nigeria",
  budget_range: "1k_5k",
  timeline: "6_months",
  optional_context: "B2B SaaS wedge",
  recommended_direction: "Start with one retailer vertical",
  top_risks: ["Unvalidated demand", "Long sales cycles", "Budget constraints"],
  top_opportunities: ["Underserved SMB retailers", "Faster onboarding angle"],
};

describe("handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    intakeRows.length = 0;
    handoffRows.length = 0;
  });

  it("maps free handoff fields into paid intake sections", () => {
    const payload = buildHandoffSectionPayload(freeTokenFields);

    expect(payload.sections_completed).toEqual([1, 3, 5, 6, 7, 8]);
    expect(payload.current_section).toBe(2);
    expect(buildSection1FromHandoff(freeTokenFields).primary_goal).toContain("B2B SaaS");
    expect(buildSection3FromHandoff(freeTokenFields).location).toBe("Lagos Nigeria");
    expect(buildSection5FromHandoff(freeTokenFields).budget).toBe("1k_5k");
  });

  it("pre-fills intake session when a valid handoff token is provided", async () => {
    const tokenRaw = "22222222-2222-2222-2222-222222222222";
    const tokenHash = await hashToken(tokenRaw);
    const data = intakePrefillFromHandoffData({
      ...freeTokenFields,
      ...buildHandoffSectionPayload(freeTokenFields),
    });

    vi.mocked(db.select).mockReturnValue(
      chain([
        {
          id: "handoff-1",
          source_tier: "free",
          target_tier: "torgima",
          data_json: data,
          consumed: false,
          expires_at: new Date(Date.now() + 60_000),
          token_hash: tokenHash,
        },
      ]) as never,
    );

    const insertChain = chain([
      {
        id: "session-prefill",
        tier: "authenticated",
        prefilled_from_handoff: true,
        sections_completed: [1, 3, 5, 6, 7, 8],
        current_section: 2,
        section_1_data: data.section_1_data,
        section_3_data: data.section_3_data,
        section_5_data: data.section_5_data,
        status: "in_progress",
      },
    ]);
    vi.mocked(db.insert).mockReturnValue(insertChain as never);
    vi.mocked(db.update).mockReturnValue(chain([{}]) as never);

    const session = await createIntakeSession("user-1", "authenticated", tokenRaw);

    expect(session.prefilled_from_handoff).toBe(true);
    expect(insertChain.values).toHaveBeenCalled();
    const inserted = intakeRows.at(-1);
    expect(inserted?.sections_completed).toEqual([1, 3, 5, 6, 7, 8]);
    expect(inserted?.current_section).toBe(2);
    expect((inserted?.section_1_data as Record<string, unknown>)?.primary_goal).toContain("B2B SaaS");
    expect((inserted?.section_3_data as Record<string, unknown>)?.location).toBe("Lagos Nigeria");
    expect((inserted?.section_5_data as Record<string, unknown>)?.budget).toBe("1k_5k");
    expect(db.update).toHaveBeenCalled();
  });

  it("ignores expired handoff tokens and starts a fresh session", async () => {
    vi.mocked(db.select).mockReturnValue(chain([]) as never);
    const insertChain = chain([
      {
        id: "session-fresh",
        tier: "authenticated",
        prefilled_from_handoff: false,
        sections_completed: [],
        current_section: 1,
        status: "in_progress",
      },
    ]);
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    const session = await createIntakeSession("user-1", "authenticated", "expired-token");
    expect(session.prefilled_from_handoff).toBe(false);
    const inserted = intakeRows.at(-1);
    expect(inserted?.sections_completed).toEqual([]);
    expect(inserted?.current_section).toBe(1);
  });

  it("cannot reuse a consumed handoff token", async () => {
    vi.mocked(db.select).mockReturnValue(chain([]) as never);
    const insertChain = chain([
      {
        id: "session-second",
        prefilled_from_handoff: false,
        sections_completed: [],
        current_section: 1,
        status: "in_progress",
      },
    ]);
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    await createIntakeSession("user-1", "authenticated", "already-used-token");
    const inserted = intakeRows.at(-1);
    expect(inserted?.prefilled_from_handoff).toBe(false);
    expect(inserted?.sections_completed).toEqual([]);
  });

  it("starts fresh when no handoff token is provided", async () => {
    vi.mocked(db.insert).mockReturnValue(
      chain([
        {
          id: "session-plain",
          prefilled_from_handoff: false,
          sections_completed: [],
          current_section: 1,
          status: "in_progress",
        },
      ]) as never,
    );

    const session = await createIntakeSession("user-1", "authenticated");
    expect(session.prefilled_from_handoff).toBe(false);
    const inserted = intakeRows.at(-1);
    expect(inserted?.sections_completed).toEqual([]);
    expect(inserted?.current_section).toBe(1);
  });

  it("loadAndValidateHandoffToken returns null for consumed tokens", async () => {
    vi.mocked(db.select).mockReturnValue(chain([]) as never);
    const token = await loadAndValidateHandoffToken("missing");
    expect(token).toBeNull();
  });

  it("creates free validation handoff payload with section blobs", async () => {
    vi.mocked(db.select).mockReturnValue(
      chain([
        {
          id: "free-1",
          industry: "Retail",
          location: "Kenya",
          budget_range: "under_1k",
          timeline: "3_months",
          additional_context: "Online shop",
          report_json: {},
          verdict: "adjust",
          validation_score: 55,
        },
      ]) as never,
    );
    vi.mocked(db.insert).mockReturnValue(chain([{ id: "handoff-new" }]) as never);
    vi.mocked(db.update).mockReturnValue(chain([{}]) as never);

    const created = await createHandoffToken("free", "torgima", "free-1");
    expect(created.token).toBeTruthy();
  });
});
