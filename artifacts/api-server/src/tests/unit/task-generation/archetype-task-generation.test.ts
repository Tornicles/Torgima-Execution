import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ARCHETYPE_FOUNDATION_PRIORITIES,
  applyArchetypeTaskOverride,
  buildBhudhiArchetypeFacts,
  getArchetypeProfileForPhase,
  isArchetypeFalseProgressRisk,
  loadArchetypeContext,
  normalizeBlueprintPhaseBucket,
  resolveArchetypeTaskOverride,
} from "../../../engines/task-generation/archetypeTaskProfiles.js";
import { getTaskProfile } from "../../../engines/erector/economic/ArchetypeRulePackLoader.js";

const loadArchetypeRulePackMock = vi.fn();

vi.mock("../../../engines/erector/economic/ArchetypeRulePackLoader.js", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../../engines/erector/economic/ArchetypeRulePackLoader.js")
  >();
  return {
    ...actual,
    loadArchetypeRulePack: (...args: unknown[]) => loadArchetypeRulePackMock(...args),
  };
});

let policyRow: Record<string, unknown> | null = {
  focus_statement: "Win with paid pilots",
  anti_focus: "Avoid vanity branding",
  rules: ["ship weekly", "avoid:logo_design"],
};
let selectRows: Array<Record<string, unknown>> = [];

function chain(result: unknown) {
  const rows = Array.isArray(result) ? result : result ? [result] : [];
  const c = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return c;
}

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => chain(selectRows)),
  },
  blueprintPolicies: {
    focus_statement: "focus_statement",
    anti_focus: "anti_focus",
    rules: "rules",
    blueprint_id: "blueprint_id",
    active: "active",
  },
  blueprints: {},
  orders: {
    id: "id",
    blueprint_id: "blueprint_id",
    user_id: "user_id",
    status: "status",
    trace_metadata: "trace_metadata",
  },
}));

describe("archetype-task-generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectRows = [];
    policyRow = {
      focus_statement: "Win with paid pilots",
      anti_focus: "Avoid vanity branding",
      rules: ["ship weekly"],
    };
    loadArchetypeRulePackMock.mockResolvedValue({
      archetype_id: "direct_service_delivery",
      core_risk: "capacity_ceiling",
      proof_required: ["paid_engagement"],
      false_progress_patterns: ["branding_without_sales", "website_before_clients"],
      proof_description: "Paid client evidence",
    });
  });

  it("defines all 10 foundation archetype profiles", () => {
    expect(Object.keys(ARCHETYPE_FOUNDATION_PRIORITIES)).toHaveLength(10);
  });

  it("TEST 1: direct_service_delivery foundation resolves to offer_creation", async () => {
    const profile = getArchetypeProfileForPhase("direct_service_delivery", "foundation");
    expect(profile?.action_type).toBe("offer_creation");
    expect(profile?.proof_type).toBe("TEXT");
    expect(profile?.proof_description?.toLowerCase()).toContain("price");
    expect(profile?.why_it_matters).toBe(
      "A direct service business launches with a client, not a website.",
    );

    const override = await resolveArchetypeTaskOverride(
      {
        archetype: "direct_service_delivery",
        core_risk: "capacity_ceiling",
        foundation_proof_required: [],
        false_progress_patterns: [],
        current_phase: "foundation",
        policy_rules: [],
        winning_conditions: [],
        failure_conditions: [],
      },
      "bp-1",
      "user-1",
    );
    expect(override?.action_type).toBe("offer_creation");
  });

  it("TEST 2: saas_platform foundation resolves to problem_interview", async () => {
    const profile = getArchetypeProfileForPhase("saas_platform", "foundation");
    expect(profile?.action_type).toBe("problem_interview");
    expect(profile?.action_type).not.toBe("feature_build");
    expect(profile?.action_type).not.toBe("product_development");
  });

  it("TEST 3: false progress prevention blocks branding and forces priority task", async () => {
    const archetypeContext = {
      archetype: "saas_platform",
      core_risk: "retention",
      foundation_proof_required: [],
      false_progress_patterns: ["branding", "website", "feature_build"],
      current_phase: "foundation" as const,
      policy_rules: [],
      winning_conditions: [],
      failure_conditions: [],
    };

    expect(isArchetypeFalseProgressRisk("branding", archetypeContext)).toBe(true);

    const forced = await resolveArchetypeTaskOverride(
      archetypeContext,
      "bp-1",
      "user-1",
      true,
    );
    expect(forced?.action_type).toBe("problem_interview");
  });

  it("TEST 4: onboarding blueprint without erector_archetype returns null context", async () => {
    const context = await loadArchetypeContext({
      id: "bp-onboarding",
      erector_archetype: null,
      erector_launch_contract_id: null,
      tier: "starter",
      metadata: {},
    } as never);

    expect(context).toBeNull();
    expect(loadArchetypeRulePackMock).not.toHaveBeenCalled();
  });

  it("TEST 5: Bhudhi TASK_DRAFTING facts include archetype context", () => {
    const facts = buildBhudhiArchetypeFacts(
      {
        archetype: "saas_platform",
        core_risk: "retention",
        foundation_proof_required: [],
        false_progress_patterns: [],
        current_phase: "foundation",
        policy_rules: ["rule-a", "rule-b", "rule-c", "rule-d"],
        winning_conditions: ["win-1", "win-2", "win-3"],
        failure_conditions: [],
      },
      ARCHETYPE_FOUNDATION_PRIORITIES.saas_platform,
      "problem_interview",
    );

    expect(facts.erector_archetype).toBe("saas_platform");
    expect(facts.archetype_core_risk).toBe("retention");
    expect(facts.action_type).toBe("problem_interview");
    expect(facts.policy_rules).toEqual(["rule-a", "rule-b", "rule-c"]);
    expect(facts.winning_conditions).toEqual(["win-1", "win-2"]);
    expect(String(facts.proof_standard)).toContain("painful workflow");
  });

  it("skips archetype override when priority task already completed", async () => {
    selectRows = [{ id: "order-1" }];

    const override = await resolveArchetypeTaskOverride(
      {
        archetype: "direct_service_delivery",
        core_risk: "capacity_ceiling",
        foundation_proof_required: [],
        false_progress_patterns: [],
        current_phase: "foundation",
        policy_rules: [],
        winning_conditions: [],
        failure_conditions: [],
      },
      "bp-1",
      "user-1",
    );

    expect(override).toBeNull();
  });

  it("getTaskProfile exposes archetype proof and false progress metadata", () => {
    const profile = getTaskProfile({
      core_risk: "algorithm_dependency",
      proof_required: ["subscriber_growth"],
      false_progress_patterns: ["posting_without_list"],
      proof_description: "Owned audience evidence",
    } as never);

    expect(profile.core_risk).toBe("algorithm_dependency");
    expect(profile.false_progress_patterns).toContain("posting_without_list");
  });

  it("applyArchetypeTaskOverride injects proof and why-it-matters", () => {
    const updated = applyArchetypeTaskOverride(
      {
        title: "Execute: Generic task",
        instruction: "Do the next action.",
        expected_output: "Completed action artifact",
        definition_of_done: "Proof attached and outcome described",
        why_it_matters: "Generic reason",
        time_estimate_minutes: 45,
      },
      ARCHETYPE_FOUNDATION_PRIORITIES.direct_service_delivery,
      "Launch consulting offer",
    );

    expect(updated.proof_required).toBe(true);
    expect(updated.proof_description?.toLowerCase()).toContain("price");
    expect(updated.why_it_matters).toContain("client");
    expect(updated.title).toContain("Offer Creation");
  });

  it("normalizes foundation phase names", () => {
    expect(normalizeBlueprintPhaseBucket("Setup & Foundation", null)).toBe("foundation");
    expect(normalizeBlueprintPhaseBucket(null, "Growth Plan")).toBe("growth");
  });
});
