import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERECTOR_EVENTS } from "../../../lib/erector-event-types.js";
import { EventTypes, resolveQueueForEventType } from "../../../types/eventContracts.js";

const { mockSelectChain, mockInsert, mockUpdate } = vi.hoisted(() => ({
  mockSelectChain: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: mockSelectChain,
    insert: mockInsert,
    update: mockUpdate,
  },
  erectorDecisionAudits: { decision_id: "decision_id", user_id: "user_id" },
  erectorModelVersions: { component: "component", current_version: "current_version" },
  erectorObservabilityLogs: { id: "id" },
  idempotencyRecords: { key: "key", result: "result" },
  erectorUserFacingExplanations: { id: "id" },
}));

vi.mock("../../../services/EventService.js", () => ({
  EVENT_TYPES: {
    ERECTOR_AUDIT_RECORD_CREATED: "erector_audit_record_created",
    ERECTOR_MODEL_VERSION_UPDATED: "erector_model_version_updated",
  },
  writeEvent: vi.fn(async () => "evt-1"),
}));

function buildSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
}

describe("erector event types", () => {
  it("registers all Prompt 12 lifecycle events", () => {
    expect(Object.keys(ERECTOR_EVENTS).length).toBeGreaterThanOrEqual(20);
    expect(EventTypes.ERECTOR_AUDIT_RECORD_CREATED).toBe(ERECTOR_EVENTS.AUDIT_RECORD_CREATED);
    expect(EventTypes.ERECTOR_EVIDENCE_SUBMITTED).toBe(ERECTOR_EVENTS.EVIDENCE_SUBMITTED);
    expect(EventTypes.ERECTOR_RESIMULATION_TRIGGERED).toBe(ERECTOR_EVENTS.RESIMULATION_TRIGGERED);
  });

  it("maps validation requested events to erector validation requested worker queue", () => {
    expect(resolveQueueForEventType(EventTypes.ERECTOR_VALIDATION_REQUESTED)).toBe(
      "erector_validation_requested",
    );
    expect(resolveQueueForEventType(EventTypes.ERECTOR_CAPABILITY_GAP_DETECTED)).toBe(
      "task_generation_requested",
    );
  });
});

describe("DecisionAuditService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectChain.mockReset();
    mockInsert.mockReset();
    mockUpdate.mockReset();
    mockInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("writes audit rows with DA decision_id format and model versions", async () => {
    mockSelectChain.mockReturnValueOnce(buildSelectChain([]));

    const { decisionAuditService } = await import(
      "../../../services/erector/DecisionAuditService.js"
    );

    const decisionId = await decisionAuditService.write({
      decisionType: "validation_verdict",
      sourceEngine: "test_engine",
      userId: "user-1",
      entityType: "erector_validation_run",
      entityId: "vr-1",
      inputSnapshot: { score: 80 },
      result: "PROCEED",
      userVisible: true,
    });

    expect(decisionId).toMatch(/^DA-/);
    expect(mockInsert).toHaveBeenCalled();
  });
});

describe("ModelVersioningService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectChain.mockReset();
  });

  it("returns all 10 components at v0.1 when table is empty", async () => {
    mockSelectChain.mockReturnValueOnce(buildSelectChain([]));

    const { ModelVersioningService } = await import(
      "../../../services/erector/ModelVersioningService.js"
    );
    const versions = await ModelVersioningService.getCurrentVersions();

    expect(Object.keys(versions)).toHaveLength(10);
    expect(versions.validation_model).toBe("v0.1");
    expect(versions.threshold_matrix).toBe("v0.1");
  });
});

describe("api idempotency helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectChain.mockReset();
    mockInsert.mockReset();
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  it("returns cached response when idempotency key already exists", async () => {
    mockSelectChain.mockReturnValueOnce(
      buildSelectChain([{ result: { ok: true, data: { session_id: "sess-1" } } }]),
    );

    const { withApiIdempotency } = await import("../../../lib/erectorApiHelpers.js");
    const handler = vi.fn();

    const result = await withApiIdempotency("intake_session_create", "key-1", handler);

    expect(result.cached).toBe(true);
    expect(result.body).toEqual({ ok: true, data: { session_id: "sess-1" } });
    expect(handler).not.toHaveBeenCalled();
  });
});
