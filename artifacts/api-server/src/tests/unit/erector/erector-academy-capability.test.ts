import { beforeEach, describe, expect, it, vi } from "vitest";

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
  erectorCapabilityGraph: {
    capability_id: "capability_id",
    active: "active",
    domain: "domain",
    available_starter: "available_starter",
    required_for_task_types: "required_for_task_types",
  },
  erectorCapabilityProfiles: {
    user_id: "user_id",
    capability_id: "capability_id",
    proof_level: "proof_level",
    proof_count: "proof_count",
    capability_signal: "capability_signal",
    decay_status: "decay_status",
  },
  academyTasks: { id: "id", user_id: "user_id", capability_gap_id: "capability_gap_id" },
  academyProof: { id: "id" },
  erectorCapabilityGaps: { id: "id", capability_id: "capability_id", status: "status" },
  blueprints: { id: "id", current_condition: "current_condition" },
}));

vi.mock("../../../services/erector/evidence/EvidenceLedgerService.js", () => ({
  evidenceLedgerService: {
    submit: vi.fn(async () => ({
      evidence_id: "evidence-1",
      evidence_class: "DIRECT_ARTIFACT",
      evidence_strength: "HIGH",
      integrity_flags: [],
    })),
  },
}));

vi.mock("../../../services/EventService.js", () => ({
  EVENT_TYPES: {
    ERECTOR_CAPABILITY_GAP_RESOLVED: "erector_capability_gap_resolved",
    ACADEMY_TASK_REQUESTED: "academy_task_requested",
  },
  writeEvent: vi.fn(async () => "evt-1"),
}));

import { determineLearningType } from "../../../engines/erector/academy/AcademyContentSelector.js";
import {
  ACTION_TYPE_CAPABILITY_MAP,
  detectCapabilityGaps,
} from "../../../engines/erector/academy/CapabilityGapDetector.js";

const mockSelectChainRef = mockSelectChain;
const mockInsertRef = mockInsert;
const mockUpdateRef = mockUpdate;

function buildSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return chain;
}

describe("capability-gap detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks task generation when copywriting capability is not proven", async () => {
    const copywritingCapability = {
      capability_id: "CAP-copywriting-01",
      capability_name: "Conversion Copywriting",
      capability_description: "Write copy that drives action",
      domain: "market",
      phase_relevance: [],
      required_for_task_types: [],
      prerequisite_capabilities: [],
      proof_required: "Published copy with measurable data",
      evidence_types_allowed: ["DIRECT_ARTIFACT", "ANALYTICS_MOVEMENT"],
      minimum_signal_threshold: 60,
      available_starter: true,
      available_growth: true,
      available_ultimate: true,
      active: true,
    };

    mockSelectChainRef
      .mockReturnValueOnce(buildSelectChain([copywritingCapability]))
      .mockReturnValueOnce(buildSelectChain([]));

    const result = await detectCapabilityGaps({
      userId: "user-1",
      blueprintId: "bp-1",
      nextActionType: "copywriting",
      domain: "market",
      phase: "foundation",
      tier: "starter",
    });

    expect(result.gap_detected).toBe(true);
    expect(result.should_block_task_generation).toBe(true);
    expect(result.gaps[0]?.capability_id).toBe("CAP-copywriting-01");
    expect(result.gaps[0]?.block_level).toBe("hard");
    expect(ACTION_TYPE_CAPABILITY_MAP.copywriting).toContain("CAP-copywriting-01");
  });

  it("does not block when capability profile is proven", async () => {
    const copywritingCapability = {
      capability_id: "CAP-copywriting-01",
      capability_name: "Conversion Copywriting",
      capability_description: "Write copy that drives action",
      domain: "market",
      phase_relevance: [],
      required_for_task_types: [],
      prerequisite_capabilities: [],
      proof_required: "Published copy with measurable data",
      evidence_types_allowed: ["DIRECT_ARTIFACT"],
      minimum_signal_threshold: 60,
      available_starter: true,
      available_growth: true,
      available_ultimate: true,
      active: true,
    };

    mockSelectChainRef
      .mockReturnValueOnce(buildSelectChain([copywritingCapability]))
      .mockReturnValueOnce(
        buildSelectChain([
          {
            capability_id: "CAP-copywriting-01",
            proof_level: "proven",
            proof_count: 2,
            capability_signal: 80,
            decay_status: "current",
          },
        ]),
      );

    const result = await detectCapabilityGaps({
      userId: "user-1",
      blueprintId: "bp-1",
      nextActionType: "copywriting",
      domain: "market",
      phase: "foundation",
      tier: "starter",
    });

    expect(result.gap_detected).toBe(false);
    expect(result.should_block_task_generation).toBe(false);
  });
});

describe("academy-runtime learning type", () => {
  it("maps danger condition to CORRECTION_LEARNING", () => {
    expect(determineLearningType("danger")).toBe("CORRECTION_LEARNING");
    expect(determineLearningType("urgency")).toBe("CORRECTION_LEARNING");
  });

  it("maps stability to CAPABILITY_ACTIVATION", () => {
    expect(determineLearningType("stability")).toBe("CAPABILITY_ACTIVATION");
  });
});

describe("academy-runtime proof validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("closes gap and marks capability proven on HIGH evidence", async () => {
    const { validateErectorAcademyProof } = await import(
      "../../../engines/erector/academy/AcademyProofValidator.js"
    );
    const { writeEvent } = await import("../../../services/EventService.js");

    mockSelectChainRef
      .mockReturnValueOnce(
        buildSelectChain([
          {
            id: "task-1",
            user_id: "user-1",
            blueprint_id: "bp-1",
            capability_gap_id: "gap-1",
          },
        ]),
      )
      .mockReturnValueOnce(
        buildSelectChain([
          {
            id: "gap-1",
            capability_id: "CAP-copywriting-01",
            status: "in_academy",
          },
        ]),
      )
      .mockReturnValueOnce(
        buildSelectChain([
          {
            capability_id: "CAP-copywriting-01",
            capability_name: "Conversion Copywriting",
            capability_description: "Write copy",
            proof_required: "Published copy",
            evidence_types_allowed: ["DIRECT_ARTIFACT", "ANALYTICS_MOVEMENT"],
            minimum_signal_threshold: 60,
          },
        ]),
      )
      .mockReturnValueOnce(buildSelectChain([]))
      .mockReturnValueOnce(buildSelectChain([]));

    mockUpdateRef.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
    mockInsertRef.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "profile-1" }]),
      }),
    });

    const result = await validateErectorAcademyProof({
      academyTaskId: "task-1",
      userId: "user-1",
      academyProofId: "proof-1",
      proofJson: { output_url: "https://example.com/copy" },
      reflection: "Published landing page copy with 4.2% conversion on first 200 visitors.",
    });

    expect(result.validated).toBe(true);
    expect(result.capability_confirmed).toBe(true);
    expect(result.signal_validated).toBe(true);
    expect(writeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "erector_capability_gap_resolved",
      }),
    );
  });
});
