import { checkFeatureFlag } from "../utils.js";
import { logger } from "../logger.js";
import { isGlobalFallbackMode } from "./BudgetController.js";

export type BhudhiCallMode =
  | "live"
  | "fallback"
  | "forced_fallback"
  | "provider_unavailable"
  | "budget_blocked";

export type BhudhiValidationStatus =
  | "success"
  | "fallback"
  | "fallback_success"
  | "forced_fallback"
  | "provider_error"
  | "schema_error"
  | "budget_blocked"
  | "source_not_allowed"
  | "rate_limited"
  | "rejected"
  | "pending"
  | "error";

export function isProviderConfigured(): boolean {
  return Boolean(
    process.env["ANTHROPIC_API_KEY"]?.trim() ||
      process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"]?.trim(),
  );
}

function isTestExplicitFallback(): boolean {
  return (
    process.env["NODE_ENV"] === "test" &&
    (process.env["BHUDHI_FORCE_FALLBACKS"] === "true" ||
      process.env["BHUDHI_FORCE_FALLBACKS"] === "1")
  );
}

function isCiEnvironment(): boolean {
  return process.env["CI"] === "true" || process.env["GITHUB_ACTIONS"] === "true";
}

export async function resolveBhudhiRuntimePolicy(): Promise<{
  allowLiveProvider: boolean;
  forceFallback: boolean;
  reason?: string;
  mode: BhudhiCallMode;
  providerConfigured: boolean;
}> {
  const providerConfigured = isProviderConfigured();

  if (isTestExplicitFallback()) {
    return {
      allowLiveProvider: false,
      forceFallback: true,
      reason: "test_explicit_fallback",
      mode: "forced_fallback",
      providerConfigured,
    };
  }

  const dbForceFallback = await isGlobalFallbackMode();
  const degradedMode = await checkFeatureFlag("degraded_mode");

  if (dbForceFallback) {
    logger.warn("[BhudhiRuntimePolicy] bhudhi_force_fallbacks enabled — live provider blocked");
    return {
      allowLiveProvider: false,
      forceFallback: true,
      reason: "bhudhi_force_fallbacks",
      mode: "forced_fallback",
      providerConfigured,
    };
  }

  if (degradedMode) {
    logger.warn("[BhudhiRuntimePolicy] degraded_mode enabled — live provider blocked");
    return {
      allowLiveProvider: false,
      forceFallback: true,
      reason: "degraded_mode",
      mode: "forced_fallback",
      providerConfigured,
    };
  }

  if (!providerConfigured) {
    const isProduction = process.env["NODE_ENV"] === "production";
    if (isProduction) {
      logger.error("[BhudhiRuntimePolicy] ANTHROPIC_API_KEY missing in production — provider unavailable");
    } else if (!isCiEnvironment()) {
      logger.warn(
        "[BhudhiRuntimePolicy] No Anthropic API key — Bhudhi will use deterministic fallbacks (local dev)",
      );
    }
    return {
      allowLiveProvider: false,
      forceFallback: true,
      reason: "provider_unavailable",
      mode: "provider_unavailable",
      providerConfigured: false,
    };
  }

  return {
    allowLiveProvider: true,
    forceFallback: false,
    mode: "live",
    providerConfigured: true,
  };
}

export function mapFailureToValidationStatus(
  reason: string | undefined,
  usedFallback: boolean,
): BhudhiValidationStatus {
  if (!usedFallback) return "success";
  const r = (reason ?? "").toLowerCase();
  if (r.includes("bhudhi_force_fallbacks") || r.includes("degraded_mode") || r === "degraded_mode") {
    return "forced_fallback";
  }
  if (r.includes("budget") || r.includes("token budget") || r.includes("call limit")) {
    return "budget_blocked";
  }
  if (r.includes("schema") || r.includes("validation failed") || r.includes("output_validation")) {
    return "schema_error";
  }
  if (
    r.includes("bhudhi_no_api_key") ||
    r.includes("provider") ||
    r.includes("anthropic") ||
    r.includes("bhudhi_model") ||
    r.includes("bhudhi_json")
  ) {
    return "provider_error";
  }
  if (r.includes("stability") || r.includes("throttle") || r.includes("rate")) {
    return "rate_limited";
  }
  if (r.includes("source_not_allowed")) {
    return "source_not_allowed";
  }
  return "fallback_success";
}
