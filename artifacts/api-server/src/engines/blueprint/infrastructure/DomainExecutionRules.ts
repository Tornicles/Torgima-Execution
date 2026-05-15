import { DOMAIN_PHASE1_STATUS, DOMAIN_LABELS, type Domain } from "../../../constants/domains.js";
import type { BlueprintTier } from "./blueprint-types.js";

export function resolveDomainExecutionRules(domain: string, tier: BlueprintTier) {
  const status = DOMAIN_PHASE1_STATUS[domain as Domain] ?? "active";
  return {
    domain,
    label: DOMAIN_LABELS[domain as Domain] ?? domain,
    phase1Status: status,
    orderIntensityCap: tier === "starter" ? "low" : tier === "growth" ? "moderate" : "high",
    allowsTargetExpansion: status !== "disabled" && tier !== "starter",
    allowsFrameworkInjection: tier !== "starter" && status !== "disabled",
    signalWeight: status === "limited" ? 0.7 : 1,
  };
}
