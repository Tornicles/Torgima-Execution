import { describe, expect, it, vi, beforeEach } from "vitest";
import { TorgimaError } from "../../../lib/errors.js";
import { ERECTOR_PAID_FALLBACK } from "../../../bhudhi/fallbacks/erector-fallbacks.js";

vi.mock("../../../services/erector/blueprint-feed-service.js", () => ({
  feedErectorToBlueprint: vi.fn(),
}));

vi.mock("../../../bhudhi/TriggerRouter.js", () => ({
  routeBhudhiRequest: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    set: vi.fn(),
    returning: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);

  return {
    db: {
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
    },
    erectorIntakeSessions: { id: "id", user_id: "user_id" },
    erectorPaidValidations: { id: "id" },
  };
});

import { db } from "@workspace/db";
import { serializeIntakeSession, saveIntakeSection } from "../../../services/erector/intake-service.js";

const baseRow = {
  id: "sess-1",
  user_id: "user-1",
  blueprint_id: null,
  tier: "authenticated" as const,
  status: "in_progress",
  current_section: 1,
  sections_completed: [] as number[],
  section_1_data: null,
  section_2_data: null,
  section_3_data: null,
  section_4_data: null,
  section_5_data: null,
  section_6_data: null,
  section_7_data: null,
  section_8_data: null,
  validation_id: null,
  prefilled_from_handoff: false,
  handoff_token_id: null,
  normalized_payload: {},
  missing_fields: [] as string[],
  ambiguity_flags: [] as string[],
  contradiction_flags: [] as string[],
  validation_ready: false,
  started_at: new Date(),
  completed_at: null,
  last_saved_at: null,
  created_at: new Date(),
};

describe("Erector intake service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serializes intake session for API responses", () => {
    const payload = serializeIntakeSession({
      ...baseRow,
      sections_completed: [1, 2],
      current_section: 3,
    });
    expect(payload.id).toBe("sess-1");
    expect(payload.sections_completed).toEqual([1, 2]);
    expect(payload.current_section).toBe(3);
    expect(payload).toHaveProperty("section_1_data");
  });

  it("rejects invalid section numbers", async () => {
    await expect(saveIntakeSection("sess-1", "user-1", 0, {})).rejects.toBeInstanceOf(TorgimaError);
    await expect(saveIntakeSection("sess-1", "user-1", 9, {})).rejects.toBeInstanceOf(TorgimaError);
  });

  it("saves section data and advances current_section", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([baseRow]),
    };
    vi.mocked(db.select).mockReturnValue(selectChain as never);

    const updated = {
      ...baseRow,
      section_1_data: { projectName: "Acme" },
      sections_completed: [1],
      current_section: 2,
    };
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([updated]),
    };
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    const row = await saveIntakeSection("sess-1", "user-1", 1, { projectName: "Acme" });
    expect(row.sections_completed).toEqual([1]);
    expect(row.current_section).toBe(2);
    expect(updateChain.set).toHaveBeenCalled();
  });
});

describe("Erector paid fallback contract", () => {
  it("includes paid-only structured fields", () => {
    expect(ERECTOR_PAID_FALLBACK.goal_structured?.cleaned_goal).toBeTruthy();
    expect(ERECTOR_PAID_FALLBACK.purpose_structured?.problem).toBeTruthy();
    expect(ERECTOR_PAID_FALLBACK.selected_path).toMatch(/current|adjusted|alternative/);
  });
});
