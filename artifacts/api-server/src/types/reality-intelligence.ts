/** Payload inside Bhudhi envelope `data` for REALITY_INTELLIGENCE. */
export interface RealityIntelligenceData {
  marketMomentum: "growing" | "declining" | "emerging" | "oversaturated" | "behavior_shifting";
  similarCompanies: Array<{
    name: string;
    reason: string;
    outcome: "succeeded" | "failed" | "pivoted";
    lesson: string;
  }>;
  positioning: {
    strongestAngle: string;
    weakestAngle: string;
    userMisconception: string;
    differentiationOpportunity: string;
  };
  whiteSpace: {
    underservedUsers: string[];
    emotionalGaps: string[];
    executionGaps: string[];
    unclaimedPositioning: string[];
  };
  strategicWarnings: string[];
  competitorWeaknesses: string[];
  blueprintSeedingInstructions: string;
}
