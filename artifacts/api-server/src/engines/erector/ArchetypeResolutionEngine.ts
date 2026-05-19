import { db, economicArchetypes } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ArchetypeResolutionOutput, EconomicArchetypeProfile } from "../../types/erector.js";
import { archetypeSeedByNumber, COUNTRY_ARCHETYPE_MAP } from "./archetypeData.js";

function normalizeCountry(country: string): string {
  return country.trim().toLowerCase();
}

function rowToProfile(row: typeof economicArchetypes.$inferSelect): EconomicArchetypeProfile {
  return {
    id: row.id,
    archetypeNumber: row.archetype_number,
    name: row.name,
    countries: row.countries ?? [],
    institutionalStrength: row.institutional_strength,
    corruptionIndex: row.corruption_index,
    infrastructureQuality: row.infrastructure_quality,
    digitalAdoption: row.digital_adoption,
    consumerPurchasingPower: row.consumer_purchasing_power,
    startupEcosystemMaturity: row.startup_ecosystem_maturity,
    regulatoryOpenness: row.regulatory_openness,
    politicalStability: row.political_stability,
    laborMarketFlexibility: row.labor_market_flexibility,
    marketCompetitionDensity: row.market_competition_density,
    consumerBehaviorPatterns: (row.consumer_behavior_patterns as string[]) ?? [],
    typicalResistancePatterns: (row.typical_resistance_patterns as string[]) ?? [],
    survivorBehaviorPatterns: (row.survivor_behavior_patterns as string[]) ?? [],
    culturalBusinessNorms: (row.cultural_business_norms as string[]) ?? [],
    primaryRiskFactors: (row.primary_risk_factors as EconomicArchetypeProfile["primaryRiskFactors"]) ?? [],
    primaryOpportunityFactors: (row.primary_opportunity_factors as EconomicArchetypeProfile["primaryOpportunityFactors"]) ?? [],
    timeframePressureMultiplier: row.timeframe_pressure_multiplier,
    executionIntensityMultiplier: row.execution_intensity_multiplier,
    blueprintDifficultyAdjustment: row.blueprint_difficulty_adjustment,
  };
}

async function loadProfile(archetypeNumber: number): Promise<EconomicArchetypeProfile> {
  const [row] = await db
    .select()
    .from(economicArchetypes)
    .where(eq(economicArchetypes.archetype_number, archetypeNumber))
    .limit(1)
    .catch(() => [] as Array<typeof economicArchetypes.$inferSelect>);
  return row ? rowToProfile(row) : archetypeSeedByNumber(archetypeNumber);
}

function warningsFor(profile: EconomicArchetypeProfile): string[] {
  const warnings = profile.primaryRiskFactors.map((risk) => risk.description).slice(0, 3);
  if (profile.archetypeNumber === 23) warnings.unshift("Payment systems, cross-border tools, and supplier access require verification before execution.");
  if ([16, 19, 21, 22, 24].includes(profile.archetypeNumber)) warnings.unshift("Institutional instability increases execution friction and verification requirements.");
  if (profile.archetypeNumber === 17) warnings.unshift("Infrastructure reliability must be treated as an execution constraint.");
  return [...new Set(warnings)];
}

export async function resolveArchetype(country: string, city?: string): Promise<ArchetypeResolutionOutput> {
  const mapping = COUNTRY_ARCHETYPE_MAP[normalizeCountry(country)] ?? { primary: 1, secondary: [] };
  const primaryArchetype = await loadProfile(mapping.primary);
  const secondaryArchetypes = await Promise.all((mapping.secondary ?? []).slice(0, 2).map(loadProfile));
  const all = [primaryArchetype, ...secondaryArchetypes];
  const combinedTimeframePressureMultiplier =
    all.reduce((sum, item, i) => sum + item.timeframePressureMultiplier * (i === 0 ? 0.7 : 0.15), 0) /
    (secondaryArchetypes.length ? 1 : 0.7);
  const combinedExecutionIntensityMultiplier =
    all.reduce((sum, item, i) => sum + item.executionIntensityMultiplier * (i === 0 ? 0.7 : 0.15), 0) /
    (secondaryArchetypes.length ? 1 : 0.7);

  const economySpecificWarnings = [...new Set(all.flatMap(warningsFor))];
  const economySpecificOpportunities = [
    ...new Set(all.flatMap((item) => item.primaryOpportunityFactors.map((opportunity) => opportunity.description))),
  ].slice(0, 5);

  return {
    primaryArchetype,
    secondaryArchetypes,
    combinedTimeframePressureMultiplier: Number(combinedTimeframePressureMultiplier.toFixed(2)),
    combinedExecutionIntensityMultiplier: Number(combinedExecutionIntensityMultiplier.toFixed(2)),
    economySpecificWarnings,
    economySpecificOpportunities,
    narrative: {
      economyNarrative: `${city ? `${city}, ` : ""}${country} maps primarily to ${primaryArchetype.name}. Validation uses this economy profile before scoring execution reality.`,
      keyWarnings: economySpecificWarnings.slice(0, 3),
      keyOpportunities: economySpecificOpportunities.slice(0, 3),
    },
  };
}
