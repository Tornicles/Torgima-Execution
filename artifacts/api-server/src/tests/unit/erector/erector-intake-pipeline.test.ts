import { describe, expect, it, vi, beforeEach } from "vitest";
import { normalizeIntake, normalizeBudgetUsd, rawIntakeFromSession } from "../../../services/erector/intake/IntakeNormalizer.js";
import { detectMissingFields } from "../../../services/erector/intake/MissingFieldDetector.js";
import { detectAmbiguity } from "../../../services/erector/intake/AmbiguityDetector.js";
import { detectContradictions } from "../../../services/erector/intake/ContradictionDetector.js";
import { computeValidationReady } from "../../../services/erector/intake/UserRealityProfileBuilder.js";
import type { NormalizedIntake } from "../../../services/erector/intake/types.js";

const fullSections = {
  section_1_data: {
    projectName: "Acme Coach",
    whatBuilding: "A subscription coaching platform for solo founders",
    whyItMatters: "Founders need structured accountability",
    desiredOutcome: "50 paying subscribers in 90 days",
  },
  section_2_data: {
    who: "Solo SaaS founders under $1M ARR",
    problem: "They lack weekly accountability and planning",
    urgency: "High — churn happens without structure",
    payingForAlternatives: "yes",
  },
  section_3_data: {
    location: "United States",
    scope: "national",
    competitors: "Notion templates, indie coaches",
    differentiation: "AI-assisted weekly planning tied to revenue goals",
  },
  section_4_data: {
    revenueModel: "Monthly subscription",
    priceRange: "$49-$99/mo",
    modelType: "SaaS",
  },
  section_5_data: {
    budget: "$1,000-$5,000",
    hoursPerWeek: "15",
    teamSize: "1",
    skillsPresent: "product, marketing",
    skillsMissing: "sales ops",
  },
  section_6_data: {
    launchDate: "2026-09-01",
    firstCustomersDate: "2026-10-01",
    finalTargetDate: "2027-03-01",
  },
  section_7_data: {
    blockers: "Limited sales experience",
    priorAttempts: "Tried a newsletter — low conversion",
  },
  section_8_data: {
    success30Days: "10 beta users and 3 paid pilots",
    success90Days: "25 subscribers and $1,500 MRR",
    success12Months: "200 subscribers and $12,000 MRR",
  },
  section_9_data: {},
};

describe("IntakeNormalizer", () => {
  it("maps all sections into NormalizedIntake", () => {
    const normalized = normalizeIntake(
      rawIntakeFromSession("sess-1", "authenticated", fullSections),
    );

    expect(normalized.project_name).toBe("Acme Coach");
    expect(normalized.what_building).toContain("coaching platform");
    expect(normalized.target_who).toContain("Solo SaaS");
    expect(normalized.market_scope).toBe("national");
    expect(normalized.revenue_model).toBe("Monthly subscription");
    expect(normalized.industry).toBe("SaaS");
    expect(normalized.budget_usd_estimate).toBe(3000);
    expect(normalized.hours_per_week).toBe(15);
    expect(normalized.team_size).toBe(1);
    expect(normalized.timeline_launch).toBe("2026-09-01");
    expect(normalized.known_blockers).toContain("Limited sales experience");
    expect(normalized.success_30_days).toContain("10 beta users");
    expect(normalized.payment_infrastructure).toBe("digital_full");
  });

  it("normalizes free tier from section 1 only", () => {
    const normalized = normalizeIntake({
      session_id: "free-1",
      tier: "free",
      section_1_data: {
        industry: "E-commerce",
        location: "Kenya",
        budget_range: "Under $100",
        timeline: "90 days",
        additional_context: "Sell handmade goods online",
      },
      section_2_data: {},
      section_3_data: {},
      section_4_data: {},
      section_5_data: {},
      section_6_data: {},
      section_7_data: {},
      section_8_data: {},
      section_9_data: {},
    });

    expect(normalized.industry).toBe("E-commerce");
    expect(normalized.location).toBe("Kenya");
    expect(normalized.budget_usd_estimate).toBe(50);
    expect(normalized.timeline_launch).toBe("90 days");
    expect(normalized.operating_context).toBe("informal");
    expect(normalized.payment_infrastructure).toBe("mobile_money");
  });

  it("converts budget text ranges to USD estimates", () => {
    expect(normalizeBudgetUsd("$100-500")).toBe(300);
    expect(normalizeBudgetUsd("Under $100")).toBe(50);
  });
});

describe("MissingFieldDetector", () => {
  const complete = normalizeIntake(rawIntakeFromSession("sess-1", "authenticated", fullSections));

  it("returns no critical missing fields for complete authenticated intake", () => {
    const result = detectMissingFields(complete, "authenticated");
    expect(result.has_missing_required).toBe(false);
    expect(result.missing_fields.filter((m) => m.priority === "critical")).toHaveLength(0);
  });

  it("requires free-tier critical fields only", () => {
    const sparse: NormalizedIntake = {
      ...complete,
      industry: null,
      location: null,
      budget_range: null,
      timeline_launch: null,
    };
    const result = detectMissingFields(sparse, "free");
    const critical = result.missing_fields.filter((m) => m.priority === "critical");
    expect(critical.map((m) => m.field)).toEqual(
      expect.arrayContaining(["industry", "location", "budget_range", "timeline_launch"]),
    );
  });

  it("requires pro-tier business fields", () => {
    const sparse: NormalizedIntake = {
      ...complete,
      what_building: null,
      revenue_model: null,
      hours_per_week: null,
      success_30_days: null,
    };
    const result = detectMissingFields(sparse, "pro");
    expect(result.missing_fields.map((m) => m.field)).toEqual(
      expect.arrayContaining(["what_building", "revenue_model", "hours_per_week", "success_30_days"]),
    );
  });
});

describe("AmbiguityDetector", () => {
  it("flags vague, broad, and unmeasurable fields", () => {
    const ambiguous = normalizeIntake(
      rawIntakeFromSession("sess-2", "authenticated", {
        ...fullSections,
        section_1_data: {
          ...fullSections.section_1_data,
          whatBuilding: "An app",
          desiredOutcome: "be successful",
        },
        section_2_data: {
          ...fullSections.section_2_data,
          who: "everyone",
        },
        section_4_data: {
          revenueModel: "not sure",
          priceRange: "$10",
          modelType: "SaaS",
        },
        section_6_data: {
          launchDate: "asap",
          firstCustomersDate: "soon",
          finalTargetDate: "later",
        },
        section_8_data: {
          success30Days: "grow fast",
          success90Days: "more traction",
          success12Months: "big outcome",
        },
      }),
    );

    const result = detectAmbiguity(ambiguous);
    expect(result.has_ambiguity).toBe(true);
    expect(result.ambiguity_flags.map((f) => f.field)).toEqual(
      expect.arrayContaining([
        "what_building",
        "desired_outcome",
        "target_who",
        "revenue_model",
        "timeline_launch",
        "success_30_days",
      ]),
    );
  });
});

describe("ContradictionDetector", () => {
  it("detects all six required contradiction types", () => {
    const normalized = normalizeIntake(
      rawIntakeFromSession("sess-3", "authenticated", {
        section_1_data: {
          whatBuilding: "Enterprise SaaS platform for global teams",
          desiredOutcome: "Launch worldwide",
        },
        section_2_data: { who: "Teams", problem: "Coordination", urgency: "High", payingForAlternatives: "yes" },
        section_3_data: {
          location: "Nigeria",
          scope: "global",
          competitors: "Slack",
          differentiation: "Cheaper",
        },
        section_4_data: { revenueModel: "", priceRange: "$99", modelType: "SaaS" },
        section_5_data: { budget: "Under $100", hoursPerWeek: "2", teamSize: "1", skillsPresent: "coding", skillsMissing: "sales" },
        section_6_data: { launchDate: "30 days", firstCustomersDate: "45 days", finalTargetDate: "60 days" },
        section_7_data: { blockers: "none", priorAttempts: "none" },
        section_8_data: {
          success30Days: "100 paying customers and full-time revenue",
          success90Days: "500 customers",
          success12Months: "enterprise contracts",
        },
      }),
    );

    const result = detectContradictions(normalized);
    const types = result.contradictions.map((c) => c.type);
    expect(types).toEqual(
      expect.arrayContaining([
        "RESOURCE_TIMELINE_MISMATCH",
        "BUDGET_ARCHETYPE_MISMATCH",
        "MARKET_SCOPE_RESOURCE_MISMATCH",
        "NO_REVENUE_MODEL_WITH_PRODUCT",
        "INFORMAL_ECONOMY_FORMAL_PRODUCT_MISMATCH",
        "CAPACITY_OVERCOMMITMENT",
      ]),
    );
  });

  it("scores SaaS + $0 budget + 2 hours/week + 30-day timeline above 70 with PIVOT timeline effect", () => {
    const normalized: NormalizedIntake = {
      project_name: null,
      what_building: "Enterprise SaaS platform for global teams",
      why_it_matters: null,
      desired_outcome: "Global launch",
      target_who: "Teams",
      problem_solved: "Coordination",
      problem_urgency: "High",
      paying_for_alternatives: true,
      location: "United States",
      market_scope: "global",
      competitors: ["Slack"],
      differentiation: "Cheaper",
      operating_context: "formal",
      revenue_model: null,
      price_range: null,
      revenue_type: "SaaS",
      budget_range: "Under $100",
      budget_usd_estimate: 0,
      hours_per_week: 2,
      team_size: 1,
      skills_present: [],
      skills_missing: [],
      timeline_launch: "30 days",
      timeline_customers: null,
      timeline_final: null,
      known_blockers: [],
      regulatory_flags: [],
      prior_attempts: [],
      success_30_days: "100 paying customers",
      success_90_days: null,
      success_12_months: null,
      payment_infrastructure: "digital_full",
      market_maturity: "saturated",
      internet_reliability: "high",
      industry: "SaaS",
      additional_context: null,
    };

    const result = detectContradictions(normalized);
    expect(result.contradiction_score).toBeGreaterThan(70);
    expect(result.contradictions.some((c) => c.type === "RESOURCE_TIMELINE_MISMATCH" && c.verdict_effect === "PIVOT")).toBe(true);
  });
});

describe("validation_ready computation", () => {
  it("is false when critical fields missing or contradiction_score >= 70", () => {
    const missing = detectMissingFields(
      normalizeIntake(rawIntakeFromSession("sess-4", "authenticated", fullSections)),
      "authenticated",
    );
    const contradictions = detectContradictions(
      normalizeIntake(rawIntakeFromSession("sess-4", "authenticated", fullSections)),
    );

    expect(computeValidationReady("authenticated", missing, contradictions)).toBe(true);

    const highContradiction = {
      has_contradictions: true,
      contradiction_score: 75,
      contradictions: [],
    };
    expect(computeValidationReady("authenticated", missing, highContradiction)).toBe(false);
  });
});

vi.mock("@workspace/db", () => {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    set: vi.fn(),
    returning: vi.fn(),
    values: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  chain.returning.mockReturnValue(chain);
  chain.values.mockReturnValue(chain);

  return {
    db: {
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
    },
    erectorIntakeSessions: { id: "id", user_id: "user_id" },
    erectorUserRealityProfiles: { id: "id" },
  };
});

vi.mock("../../../services/EventService.js", () => ({
  EVENT_TYPES: {
    ERECTOR_INTAKE_NORMALIZED: "erector_intake_normalized",
    ERECTOR_VALIDATION_REQUESTED: "erector_validation_requested",
  },
  writeEvent: vi.fn(async () => "evt-1"),
}));

import { db } from "@workspace/db";
import { writeEvent, EVENT_TYPES } from "../../../services/EventService.js";
import { runIntakePipeline } from "../../../services/erector/intake/IntakePipeline.js";

describe("runIntakePipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes profile, updates session flags, and emits events", async () => {
    const session = {
      id: "sess-pipe",
      user_id: "user-1",
      tier: "authenticated",
      ...fullSections,
    };

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([session]),
    };
    vi.mocked(db.select).mockReturnValue(selectChain as never);

    const profileChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.select).mockReturnValueOnce(selectChain as never).mockReturnValueOnce(profileChain as never);

    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "profile-1" }]),
    };
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    const result = await runIntakePipeline("sess-pipe", "user-1");

    expect(result.profile_id).toBe("profile-1");
    expect(result.validation_ready).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        validation_ready: true,
        missing_fields: expect.any(Array),
        ambiguity_flags: expect.any(Array),
        contradiction_flags: expect.any(Array),
      }),
    );
    expect(writeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: EVENT_TYPES.ERECTOR_INTAKE_NORMALIZED }),
    );
    expect(writeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: EVENT_TYPES.ERECTOR_VALIDATION_REQUESTED }),
    );
  });
});
