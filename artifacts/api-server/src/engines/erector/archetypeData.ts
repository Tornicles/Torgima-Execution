import type { EconomicArchetypeProfile } from "../../types/erector.js";

export type ArchetypeSeed = Omit<EconomicArchetypeProfile, "id">;

const BASE_BEHAVIOR = [
  "Trust is earned through visible proof and repeated delivery.",
  "Buyers compare alternatives before committing resources.",
  "Execution credibility matters more than broad positioning claims.",
];

function bounded(n: number): number {
  return Math.max(1, Math.min(10, Number(n.toFixed(2))));
}

function profile(
  archetypeNumber: number,
  name: string,
  countries: string[],
  corruptionIndex: number,
  digitalAdoption: number,
  marketCompetitionDensity: number,
  pressure: string,
  overrides: Partial<ArchetypeSeed> = {},
): ArchetypeSeed {
  const institutionalStrength = bounded(11 - corruptionIndex);
  const infrastructureQuality = bounded((digitalAdoption + institutionalStrength) / 2);
  return {
    archetypeNumber,
    name,
    countries,
    institutionalStrength,
    corruptionIndex,
    infrastructureQuality,
    digitalAdoption,
    consumerPurchasingPower: bounded(institutionalStrength + digitalAdoption / 5 - corruptionIndex / 6),
    startupEcosystemMaturity: bounded((digitalAdoption + marketCompetitionDensity) / 2),
    regulatoryOpenness: bounded(institutionalStrength - corruptionIndex / 8 + 1),
    politicalStability: bounded(institutionalStrength - corruptionIndex / 5 + 1),
    laborMarketFlexibility: bounded(5.5 + corruptionIndex / 8),
    marketCompetitionDensity,
    consumerBehaviorPatterns: BASE_BEHAVIOR,
    typicalResistancePatterns: [pressure, "Weak differentiation slows early traction.", "Underestimating execution intensity creates stalled momentum."],
    survivorBehaviorPatterns: ["Winners narrow the first market and prove value quickly.", "They build distribution before expanding scope.", "They adapt offers to local trust and payment behavior."],
    culturalBusinessNorms: ["Relationship quality affects conversion speed.", "Local proof beats abstract claims."],
    primaryRiskFactors: [
      { name: "Execution friction", description: pressure, severity: corruptionIndex >= 7 ? "high" : "medium" },
      { name: "Trust delay", description: "Customers need evidence before switching behavior.", severity: "medium" },
      { name: "Resource mismatch", description: "Budget and current resources must match the timeframe.", severity: "medium" },
    ],
    primaryOpportunityFactors: [
      { name: "Proof gap", description: "Competitors often fail to show concrete execution proof." },
      { name: "Local adaptation", description: "A locally adjusted offer can outperform generic positioning." },
      { name: "Focused wedge", description: "A narrow first segment reduces launch waste." },
    ],
    timeframePressureMultiplier: corruptionIndex >= 7 ? 1.25 : marketCompetitionDensity >= 8 ? 1.15 : 1,
    executionIntensityMultiplier: corruptionIndex >= 7 ? 1.35 : marketCompetitionDensity >= 8 ? 1.2 : 1,
    blueprintDifficultyAdjustment: corruptionIndex >= 7 ? 1.5 : marketCompetitionDensity >= 8 ? 0.8 : 0,
    ...overrides,
  };
}

export const ERECTOR_ARCHETYPE_SEEDS: ArchetypeSeed[] = [
  profile(1, "Consumer Capitalist Economy", ["United States", "USA", "Canada", "Australia", "New Zealand"], 1.5, 9.0, 9.5, "Market saturation and paid acquisition pressure.", { blueprintDifficultyAdjustment: 0.4 }),
  profile(2, "Welfare Industrial Economy", ["Sweden", "Norway", "Denmark", "Germany", "Netherlands", "Switzerland"], 1.5, 8.5, 7.0, "Regulatory standards and high quality expectations."),
  profile(3, "Financial Mega-City Economy", ["Singapore", "UAE", "United Arab Emirates", "Hong Kong", "Luxembourg", "Monaco"], 2.0, 9.5, 8.5, "Elite capital pressure and high operating costs."),
  profile(4, "Export Technology Economy", ["South Korea", "Taiwan"], 3.0, 9.0, 8.0, "Global technology competitiveness and engineering quality pressure."),
  profile(5, "High-Efficiency Manufacturing Economy", ["Japan", "Czech Republic", "Czechia"], 2.0, 8.5, 7.5, "Operational discipline and process reliability expectations."),
  profile(6, "Oil Wealth Economy", ["Saudi Arabia", "Qatar", "Kuwait", "Oman", "Brunei"], 4.0, 8.0, 5.0, "Centralized wealth and government influence."),
  profile(7, "Rapid Urbanization Economy", ["India", "Nigeria", "Pakistan", "Indonesia", "Philippines"], 6.0, 6.0, 7.0, "Infrastructure pressure and fast-changing middle-class demand.", { executionIntensityMultiplier: 1.25 }),
  profile(8, "Manufacturing Expansion Economy", ["Vietnam", "Bangladesh", "Cambodia", "Myanmar"], 5.0, 5.5, 5.0, "Low-cost labor dynamics and export dependency."),
  profile(9, "Tourism Economy", ["Thailand", "Maldives", "Jamaica", "Fiji", "Bahamas"], 4.5, 6.5, 5.5, "Seasonality and international demand dependency."),
  profile(10, "Port Logistics Economy", ["Panama"], 2.5, 8.0, 6.0, "Trade hub dependency and supply-chain resilience."),
  profile(11, "Commodity Export Economy", ["Brazil", "Chile", "Zambia", "DRC", "Democratic Republic of Congo", "Kazakhstan"], 5.5, 6.0, 5.0, "Resource price volatility and foreign corporate influence."),
  profile(12, "State-Controlled Hybrid Economy", ["China", "Laos"], 6.5, 8.0, 8.5, "Centralized oversight and political navigation."),
  profile(13, "Agricultural Labor Economy", ["Niger", "Chad", "Mali", "Uganda", "Malawi"], 6.0, 2.0, 1.5, "Low-tech adaptability and climate dependency.", { executionIntensityMultiplier: 1.5, blueprintDifficultyAdjustment: 2 }),
  profile(14, "Informal Cash Economy", ["Kenya", "Ghana", "Bolivia", "Haiti"], 7.0, 5.0, 4.0, "Trust systems, bank access gaps, and cash dependency.", { consumerBehaviorPatterns: ["WhatsApp and relationship referrals carry high commercial weight.", "Cash and mobile-money trust signals matter.", "Community proof is stronger than polished brand claims."] }),
  profile(15, "Aid-Dependent Economy", ["South Sudan", "Somalia", "Afghanistan", "Yemen"], 8.0, 1.5, 1.0, "Institutional fragility and donor instability.", { executionIntensityMultiplier: 1.8, blueprintDifficultyAdjustment: 2.5 }),
  profile(16, "Corruption-Heavy Economy", ["Russia", "Venezuela", "Zimbabwe", "Iraq"], 9.0, 6.0, 5.0, "Bribery navigation and political favoritism.", { executionIntensityMultiplier: 1.6, blueprintDifficultyAdjustment: 2 }),
  profile(17, "Infrastructure-Deficient Economy", ["Liberia", "Central African Republic", "Sierra Leone", "Madagascar"], 7.0, 2.5, 2.0, "Operational resilience under infrastructure failure.", { executionIntensityMultiplier: 1.7, blueprintDifficultyAdjustment: 2 }),
  profile(18, "Overpopulated Urban Poverty Economy", ["Bangladesh", "Parts of India", "Parts of Nigeria", "Parts of Philippines"], 6.5, 5.0, 5.5, "Affordability pressure and high-density social scaling."),
  profile(19, "Black Market War Economy", ["Syria", "Libya", "Parts of Afghanistan"], 9.5, 3.0, 2.5, "Underground logistics and conflict interference.", { executionIntensityMultiplier: 2, blueprintDifficultyAdjustment: 3 }),
  profile(20, "Occupied Territory Economy", ["Palestinian territories", "Palestine"], 7.5, 4.0, 2.0, "Restricted movement and external governance.", { executionIntensityMultiplier: 1.8, blueprintDifficultyAdjustment: 2.5 }),
  profile(21, "Civil War Economy", ["Sudan", "Conflict Myanmar", "Conflict Syria"], 9.0, 2.0, 1.5, "Fragmented control and crisis survival management.", { executionIntensityMultiplier: 2, blueprintDifficultyAdjustment: 3 }),
  profile(22, "Militia-Controlled Economy", ["Parts of DRC", "Parts of Somalia", "Parts of Libya"], 9.5, 1.5, 1.5, "Coercive power navigation and security dependency.", { executionIntensityMultiplier: 2, blueprintDifficultyAdjustment: 3 }),
  profile(23, "Sanctioned Economy", ["Iran", "North Korea", "Sanctioned Russia", "Sanctioned Syria"], 8.5, 4.5, 3.5, "Payment restrictions, inflation survival, and underground alternatives.", { typicalResistancePatterns: ["Payment rails and international transfers are constrained.", "Supply chains require verification and redundancy.", "Inflation can invalidate assumptions quickly."] }),
  profile(24, "Post-Collapse Survival Economy", ["Parts of Haiti", "Parts of Somalia", "Parts of Yemen"], 8.5, 2.0, 1.0, "Minimal resource survival and reconstruction dependency.", { executionIntensityMultiplier: 2, blueprintDifficultyAdjustment: 3 }),
  profile(25, "Creator Economy", ["Creator United States", "Creator South Korea", "Creator Japan", "Creator Brazil", "Creator India"], 2.0, 9.5, 9.0, "Attention retention and algorithm dependency.", { consumerBehaviorPatterns: ["Audience trust follows consistency and proof.", "Retention beats reach.", "Personal credibility compounds over time."] }),
  profile(26, "Gig Platform Economy", ["Gig United States", "Gig India", "Gig Indonesia", "Gig Philippines", "Gig Brazil"], 2.5, 8.5, 8.0, "Platform dependency and unstable income."),
  profile(27, "Freelance Digital Economy", ["Freelance India", "Pakistan", "Ukraine", "Freelance Nigeria", "Philippines Freelance"], 4.0, 7.5, 7.5, "Global competition and independent worker sustainability."),
  profile(28, "SaaS Startup Economy", ["SaaS United States", "Israel", "Estonia", "SaaS India", "SaaS Singapore"], 1.5, 9.5, 9.5, "Rapid scaling pressure, churn, and product-market fit."),
  profile(29, "AI Automation Economy", ["AI United States", "AI China", "AI Japan", "AI South Korea", "AI Singapore"], 2.0, 9.5, 9.0, "Automation disruption and AI competitiveness."),
  profile(30, "Cybercrime / Dark Web Economy", ["Cyber Russia", "Cyber North Korea", "Eastern Europe hubs"], 9.5, 8.0, 2.0, "Fraud resistance and digital trust architecture.", { primaryOpportunityFactors: [{ name: "Security trust", description: "Businesses pay for resilience and verification." }, { name: "Risk education", description: "Clear security guidance has high perceived value." }] }),
];

export const COUNTRY_ARCHETYPE_MAP: Record<string, { primary: number; secondary?: number[] }> = {
  "united states": { primary: 1, secondary: [25, 28] }, usa: { primary: 1, secondary: [25, 28] }, canada: { primary: 1, secondary: [25] }, australia: { primary: 1, secondary: [25] }, "new zealand": { primary: 1, secondary: [25] },
  germany: { primary: 2, secondary: [5] }, sweden: { primary: 2 }, norway: { primary: 2 }, denmark: { primary: 2 }, netherlands: { primary: 2, secondary: [10] }, switzerland: { primary: 2 }, ireland: { primary: 2, secondary: [28] },
  singapore: { primary: 3, secondary: [10, 28] }, uae: { primary: 3, secondary: [6] }, "united arab emirates": { primary: 3, secondary: [6] }, "hong kong": { primary: 3 }, luxembourg: { primary: 3 }, monaco: { primary: 3 },
  "south korea": { primary: 4, secondary: [25, 29] }, taiwan: { primary: 4 }, japan: { primary: 5, secondary: [25, 29] }, czechia: { primary: 5 }, "czech republic": { primary: 5 },
  "saudi arabia": { primary: 6 }, qatar: { primary: 6 }, kuwait: { primary: 6 }, oman: { primary: 6 }, brunei: { primary: 6 },
  india: { primary: 7, secondary: [18, 27] }, nigeria: { primary: 7, secondary: [14, 27] }, pakistan: { primary: 7, secondary: [27] }, indonesia: { primary: 7, secondary: [26] }, philippines: { primary: 7, secondary: [26, 27] },
  vietnam: { primary: 8, secondary: [12] }, bangladesh: { primary: 8, secondary: [18] }, cambodia: { primary: 8 }, myanmar: { primary: 21 },
  thailand: { primary: 9 }, maldives: { primary: 9 }, jamaica: { primary: 9 }, fiji: { primary: 9 }, bahamas: { primary: 9 }, panama: { primary: 10 },
  brazil: { primary: 11, secondary: [26, 25] }, chile: { primary: 11 }, zambia: { primary: 11 }, drc: { primary: 11, secondary: [22] }, kazakhstan: { primary: 11 },
  china: { primary: 12, secondary: [29] }, laos: { primary: 12 }, niger: { primary: 13 }, chad: { primary: 13 }, mali: { primary: 13 }, uganda: { primary: 13 }, malawi: { primary: 13 },
  kenya: { primary: 14, secondary: [27] }, ghana: { primary: 14 }, bolivia: { primary: 14 }, haiti: { primary: 24, secondary: [14] },
  "south sudan": { primary: 15 }, somalia: { primary: 15, secondary: [22, 24] }, afghanistan: { primary: 15, secondary: [19] }, yemen: { primary: 24, secondary: [15] },
  russia: { primary: 16, secondary: [23, 30] }, venezuela: { primary: 16 }, zimbabwe: { primary: 16 }, iraq: { primary: 16 }, liberia: { primary: 17 }, "central african republic": { primary: 17 }, "sierra leone": { primary: 17 }, madagascar: { primary: 17 },
  syria: { primary: 19, secondary: [23] }, libya: { primary: 19, secondary: [22] }, palestine: { primary: 20 }, sudan: { primary: 21 }, iran: { primary: 23 }, "north korea": { primary: 23, secondary: [30] },
  israel: { primary: 28 }, estonia: { primary: 28 }, ukraine: { primary: 27 },
};

export function archetypeSeedByNumber(archetypeNumber: number): EconomicArchetypeProfile {
  const seed = ERECTOR_ARCHETYPE_SEEDS.find((item) => item.archetypeNumber === archetypeNumber) ?? ERECTOR_ARCHETYPE_SEEDS[0]!;
  return { ...seed, id: `seed-${seed.archetypeNumber}` };
}
