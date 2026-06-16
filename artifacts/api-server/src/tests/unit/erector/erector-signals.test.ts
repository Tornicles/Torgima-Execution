import { describe, expect, it } from "vitest";
import { calculateQualitySignal } from "../../../engines/erector/signals/signal-calculators/qualitySignal.js";
import { calculateFalseProgressSignal } from "../../../engines/erector/signals/signal-calculators/falseProgressSignal.js";
import { ERECTOR_SIGNAL_TYPES } from "../../../engines/erector/signals/types.js";
import { calculateConsistencySignal } from "../../../engines/erector/signals/signal-calculators/consistencySignal.js";
import { calculateCompletionSignal } from "../../../engines/erector/signals/signal-calculators/completionSignal.js";
import { calculateOutcomeMovementSignal } from "../../../engines/erector/signals/signal-calculators/outcomeMovementSignal.js";
import { calculateCapabilitySignal } from "../../../engines/erector/signals/signal-calculators/capabilitySignal.js";
import { calculateDemandSignal } from "../../../engines/erector/signals/signal-calculators/demandSignal.js";
import { calculateMarketSignal } from "../../../engines/erector/signals/signal-calculators/marketSignal.js";
import { calculateFeasibilitySignal } from "../../../engines/erector/signals/signal-calculators/feasibilitySignal.js";
import { calculateContradictionSignal } from "../../../engines/erector/signals/signal-calculators/contradictionSignal.js";
import { calculateRetentionSignal } from "../../../engines/erector/signals/signal-calculators/retentionSignal.js";
import { calculateEconomicSignal } from "../../../engines/erector/signals/signal-calculators/economicSignal.js";
import { calculatePhaseReadinessSignal } from "../../../engines/erector/signals/signal-calculators/phaseReadinessSignal.js";

describe("erector-signals calculators", () => {
  it("defines exactly 13 erector signal types", () => {
    expect(ERECTOR_SIGNAL_TYPES).toHaveLength(13);
  });

  it("calculates quality_signal near 77 for avg 8.5 and skip_ratio 0.1", () => {
    const result = calculateQualitySignal({
      feedbackScores: [8.5, 8.5, 8.5],
      skipCount: 1,
      totalCount: 10,
      avgConfidenceWeight: 1,
    });
    expect(result.signal_type).toBe("QUALITY_SIGNAL");
    expect(result.value).toBeGreaterThanOrEqual(74);
    expect(result.value).toBeLessThanOrEqual(79);
  });

  it("calculates false_progress_signal above 60 for 2 high and 1 medium open flags", () => {
    const result = calculateFalseProgressSignal({
      openFlags: [{ severity: "HIGH" }, { severity: "HIGH" }, { severity: "MEDIUM" }],
      expectedProgressPoints: 10,
    });
    expect(result.signal_type).toBe("FALSE_PROGRESS_SIGNAL");
    expect(result.value).toBeGreaterThan(60);
    expect(result.value).toBeLessThanOrEqual(100);
  });

  it("keeps all calculator outputs within 0-100", () => {
    const results = [
      calculateConsistencySignal({ activeDays: 5, windowDays: 7 }),
      calculateCompletionSignal({ completedCount: 4, assignedCount: 6 }),
      calculateOutcomeMovementSignal({ highEvidenceCount: 2, expectedEvidenceCount: 3, evidenceIds: [] }),
      calculateCapabilitySignal({ capabilitySignals: [40, 80] }),
      calculateDemandSignal({ validationDemandScore: 55, evidenceDerivedScore: 70, evidenceIds: [] }),
      calculateMarketSignal({ marketScore: 80, weeksSinceNewEvidence: 2, evidenceIds: [] }),
      calculateFeasibilitySignal({
        feasibilityScore: 70,
        statedHoursPerWeek: 20,
        actualHoursPerWeek: 15,
      }),
      calculateContradictionSignal({ contradictedCount: 1, totalEvidenceCount: 5, evidenceIds: [] }),
      calculateRetentionSignal({
        archetype: "saas_platform",
        retentionEvidenceCount: 1,
        expectedRetentionCount: 2,
        evidenceIds: [],
      }),
      calculateEconomicSignal({
        sustainabilityScore: 0.65,
        revenueEvidenceCount: 1,
        costEvidenceCount: 0,
        evidenceIds: [],
      }),
      calculatePhaseReadinessSignal({ readinessScore: 72 }),
    ];

    for (const result of results) {
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(100);
    }
  });
});
