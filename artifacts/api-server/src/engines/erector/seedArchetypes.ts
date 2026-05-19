import { db, economicArchetypes } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ERECTOR_ARCHETYPE_SEEDS } from "./archetypeData.js";

export async function seedEconomicArchetypes(): Promise<number> {
  let count = 0;
  for (const item of ERECTOR_ARCHETYPE_SEEDS) {
    const values = {
      archetype_number: item.archetypeNumber,
      name: item.name,
      countries: item.countries,
      institutional_strength: item.institutionalStrength,
      corruption_index: item.corruptionIndex,
      infrastructure_quality: item.infrastructureQuality,
      digital_adoption: item.digitalAdoption,
      consumer_purchasing_power: item.consumerPurchasingPower,
      startup_ecosystem_maturity: item.startupEcosystemMaturity,
      regulatory_openness: item.regulatoryOpenness,
      political_stability: item.politicalStability,
      labor_market_flexibility: item.laborMarketFlexibility,
      market_competition_density: item.marketCompetitionDensity,
      consumer_behavior_patterns: item.consumerBehaviorPatterns,
      typical_resistance_patterns: item.typicalResistancePatterns,
      survivor_behavior_patterns: item.survivorBehaviorPatterns,
      cultural_business_norms: item.culturalBusinessNorms,
      primary_risk_factors: item.primaryRiskFactors,
      primary_opportunity_factors: item.primaryOpportunityFactors,
      timeframe_pressure_multiplier: item.timeframePressureMultiplier,
      execution_intensity_multiplier: item.executionIntensityMultiplier,
      blueprint_difficulty_adjustment: item.blueprintDifficultyAdjustment,
    };
    const [existing] = await db
      .select({ id: economicArchetypes.id })
      .from(economicArchetypes)
      .where(eq(economicArchetypes.archetype_number, item.archetypeNumber))
      .limit(1);
    if (existing) {
      await db.update(economicArchetypes).set(values).where(eq(economicArchetypes.id, existing.id));
    } else {
      await db.insert(economicArchetypes).values(values);
    }
    count++;
  }
  return count;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedEconomicArchetypes()
    .then((count) => {
      console.log(`Seeded ${count} economic archetypes.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
