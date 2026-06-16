import type { ArchetypeRulePack, ProfileInput, UnitEconomics } from "./types.js";

function parsePriceMidpoint(priceRange: string | null): number | null {
  if (!priceRange) return null;
  const numbers = priceRange.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (numbers.length === 0) return null;
  if (numbers.length === 1) return numbers[0]!;
  return (numbers[0]! + numbers[numbers.length - 1]!) / 2;
}

function hoursPerWeek(profile: ProfileInput): number {
  const hours = profile.hours_per_week;
  if (typeof hours === "number" && hours > 0) return hours;
  return 20;
}

export function computeUnitEconomics(
  profile: ProfileInput,
  primaryArchetype: string,
  _rulePack?: ArchetypeRulePack | null,
): UnitEconomics {
  const price = parsePriceMidpoint(profile.price_range);
  const budget = profile.budget_usd_estimate ?? 0;
  const weeklyHours = hoursPerWeek(profile);

  let capacity_limit_per_month: number | null = null;
  if (
    primaryArchetype === "direct_service_delivery" ||
    primaryArchetype === "consulting_advisory"
  ) {
    const hoursPerUnit = 8;
    capacity_limit_per_month = Math.floor((weeklyHours * 4) / hoursPerUnit);
  } else if (primaryArchetype === "physical_product_inventory") {
    capacity_limit_per_month = 200;
  }

  const estimated_monthly_revenue_ceiling =
    price != null && capacity_limit_per_month != null
      ? price * capacity_limit_per_month
      : price != null
        ? price * 50
        : null;

  const fixedMonthlyCost = Math.max(50, budget * 0.05);
  const variableCostRate =
    primaryArchetype === "physical_product_inventory"
      ? 0.55
      : primaryArchetype === "saas_platform"
        ? 0.15
        : 0.25;

  const estimated_monthly_cost =
    price != null && capacity_limit_per_month != null
      ? fixedMonthlyCost + price * capacity_limit_per_month * variableCostRate
      : fixedMonthlyCost;

  const gross_margin_estimate =
    price != null ? Math.max(0, Math.min(1, 1 - variableCostRate)) : null;

  const contribution = price != null && gross_margin_estimate != null ? price * gross_margin_estimate : null;
  const break_even_units =
    contribution != null && contribution > 0
      ? Math.ceil(fixedMonthlyCost / contribution)
      : null;

  const break_even_months =
    break_even_units != null && capacity_limit_per_month != null && capacity_limit_per_month > 0
      ? Math.ceil(break_even_units / capacity_limit_per_month)
      : null;

  const inventory_exposure = primaryArchetype === "physical_product_inventory";

  let liquidity_requirement: UnitEconomics["liquidity_requirement"] = "low";
  if (inventory_exposure || budget >= 5000) liquidity_requirement = "high";
  else if (budget >= 1000) liquidity_requirement = "medium";

  let sustainability_score = 0.6;
  if (gross_margin_estimate != null && gross_margin_estimate >= 0.5) sustainability_score += 0.15;
  if (break_even_months != null && break_even_months <= 6) sustainability_score += 0.1;
  if (capacity_limit_per_month != null && capacity_limit_per_month >= 10) sustainability_score += 0.05;
  sustainability_score = Math.min(1, Math.max(0, sustainability_score));

  return {
    price_per_unit: price,
    estimated_monthly_revenue_ceiling,
    estimated_monthly_cost,
    gross_margin_estimate,
    capacity_limit_per_month,
    break_even_units,
    break_even_months,
    inventory_exposure,
    liquidity_requirement,
    sustainability_score,
  };
}
