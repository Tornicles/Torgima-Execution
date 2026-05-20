import type { ArchetypeResolutionOutput, ErectorValidationInput } from "../../types/erector.js";

/** Rule-engine baseline when Bhudhi is unavailable or returns thin output. */
export function buildDeterministicErectorPayload(
  input: ErectorValidationInput,
  archetype: ArchetypeResolutionOutput,
) {
  const economy = archetype.primaryArchetype;
  const goal = input.rawGoal;
  const purposeDecomposition = {
    problemClaim: input.purpose,
    valueClaim: input.desiredOutcome,
    changeClaim: goal,
    motivationProfile: input.commitmentLevel,
    contradictions: input.knownBlockers ?? [],
    clarityScore: goal.length > 20 && input.targetCustomer.length > 5 ? 8 : 5.5,
  };
  const industryIntelligence = {
    industryState: economy.marketCompetitionDensity > 8 ? "SATURATED" : economy.digitalAdoption > 7 ? "GROWING" : "FORMING",
    trendDirection: economy.digitalAdoption > 7 ? "rising" : "uneven",
    saturationLevel: economy.marketCompetitionDensity,
    momentumScore: Math.max(3, Math.min(9, economy.digitalAdoption * 0.65 + input.currentResources.length * 0.5)),
    failurePatterns: economy.typicalResistancePatterns,
    industry_state_narrative: `${economy.name} shapes demand through ${economy.consumerBehaviorPatterns[0] ?? "local proof norms"} and ${economy.marketCompetitionDensity >= 7 ? "high competition density" : "emerging competition"}.`,
  };
  const marketAnalysis = {
    demandScore: Math.max(2, Math.min(9, economy.consumerPurchasingPower * 0.7 + economy.digitalAdoption * 0.2)),
    competitionScore: Math.max(1, 10 - economy.marketCompetitionDensity),
    profitabilityScore: Math.max(2, economy.consumerPurchasingPower - economy.corruptionIndex * 0.2),
    accessibilityScore: Math.max(1, economy.infrastructureQuality - economy.corruptionIndex * 0.1),
    scalabilityScore: Math.max(1, economy.digitalAdoption - economy.blueprintDifficultyAdjustment),
    sustainabilityScore: Math.max(1, economy.politicalStability - economy.corruptionIndex * 0.1),
  };
  const competitorAnalysis = {
    competitors: Array.from({ length: 5 }, (_, index) => ({
      name: `${economy.name} operator ${index + 1}`,
      positioningStrategy: "Local proof, visible outcomes, and narrow wedge positioning.",
      monetizationModel: input.businessModel,
      acquisitionChannels:
        economy.archetypeNumber === 14 ? ["WhatsApp", "referrals", "community proof"] : ["content", "search", "partner referrals"],
      survivorPatterns: economy.survivorBehaviorPatterns,
    })),
  };
  const economyBriefing = {
    briefingNarrative: archetype.narrative?.economyNarrative ?? `${input.location.country} maps to ${economy.name}.`,
    paymentSystemWarnings: archetype.economySpecificWarnings.filter((w) => /payment|cash|bank|transfer/i.test(w)),
    corruptionGuidance:
      economy.corruptionIndex >= 7
        ? "Use documented transactions, trusted local partners, and verification steps."
        : "Standard verification controls are sufficient.",
    trustBuildingTimeline:
      economy.corruptionIndex >= 7 ? "Expect trust building to take longer than the base plan." : "Trust can compound through weekly proof.",
    platformRecommendations:
      economy.archetypeNumber === 14 ? ["WhatsApp", "local referrals"] : ["owned content", "email", "search"],
    keyWarnings: archetype.economySpecificWarnings.slice(0, 4),
    keyOpportunities: archetype.economySpecificOpportunities.slice(0, 4),
  };
  const customerPainAnalysis = {
    topPainPoints: [`Specific pain for ${input.targetCustomer}`, "Lack of trustworthy proof", "Slow implementation"],
    urgencyLevel: economy.consumerPurchasingPower >= 6 ? "medium" : "low",
    willingnessToPay: economy.consumerPurchasingPower >= 7 ? "medium-high" : "constrained",
    emotionalTriggers: economy.consumerBehaviorPatterns,
    underservedFrustrations: ["Generic solutions", "Unclear ROI", "Weak follow-through"],
  };
  const executionDifficulty = {
    dailyIntensity: archetype.combinedExecutionIntensityMultiplier,
    infrastructureConstraint: economy.infrastructureQuality < 5,
    requiredProofCadence: "weekly",
    difficultyLabel: economy.blueprintDifficultyAdjustment >= 2 ? "high" : "moderate",
    skillGap: economy.blueprintDifficultyAdjustment >= 2 ? "high" : "moderate",
    capitalRequirement: input.budgetAvailable < 2500 ? "constrained" : "adequate",
    timeToRevenue: input.timeframe === "30d" ? "aggressive" : "staged",
    regulatoryFriction: economy.corruptionIndex >= 7 ? "elevated" : "standard",
  };
  return {
    purposeDecomposition,
    industryIntelligence,
    marketAnalysis,
    competitorAnalysis,
    economyBriefing,
    customerPainAnalysis,
    executionDifficulty,
    timingAnalysis: industryIntelligence,
  };
}
