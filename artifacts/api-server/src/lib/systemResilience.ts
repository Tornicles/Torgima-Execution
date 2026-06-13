/**
 * System Resilience Layer — Launch Mode graceful degradation.
 *
 * Pattern: Primary Path → Fallback Path → Safe Response.
 * A failure in one subsystem must not stop the core user journey.
 */

import { logger } from "./logger.js";
import { isLaunchMode } from "./launch-mode.js";
import { isDbConnectivityError } from "./dbConnectivity.js";

export type ResilienceOutcome<T> = {
  value: T;
  usedFallback: boolean;
  fallbackReason?: string;
};

export type ResilienceOptions = {
  /** Label for logs (route or subsystem name). */
  label: string;
  /** When true, always use fallback (simulates subsystem OFF). */
  forceFallback?: boolean;
  /** When true, skip primary and use fallback immediately in launch mode. */
  preferFallbackInLaunchMode?: boolean;
};

/**
 * When true, advanced intelligence (Bhudhi, Erector AI, Anthropic) is optional —
 * deterministic fallbacks must always succeed.
 */
export function isAdvancedIntelligenceOptional(): boolean {
  return isLaunchMode();
}

/** True when subsystem failures should degrade instead of throwing to the client. */
export function shouldDegradeOnFailure(err: unknown): boolean {
  return isLaunchMode() || isDbConnectivityError(err);
}

/**
 * Run primary work; on failure invoke fallback. Never throws when fallback is provided.
 */
export async function runWithResilience<T>(
  options: ResilienceOptions,
  primary: () => Promise<T>,
  fallback: (reason: string, err: unknown) => Promise<T>,
): Promise<ResilienceOutcome<T>> {
  if (options.forceFallback) {
    logger.info({ label: options.label }, "[Resilience] Forced fallback");
    const value = await fallback("forced", null);
    return { value, usedFallback: true, fallbackReason: "forced" };
  }

  try {
    const value = await primary();
    return { value, usedFallback: false };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (!isLaunchMode() && !isDbConnectivityError(err)) {
      throw err;
    }
    logger.warn({ label: options.label, err: reason }, "[Resilience] Primary failed — fallback");
    const value = await fallback(reason, err);
    return { value, usedFallback: true, fallbackReason: reason };
  }
}

/** Safe default tier/path for launch when user selection is missing. */
export function launchDefaultTier(): "starter" | "growth" | "ultimate" {
  return "starter";
}

export function launchDefaultPath(): "current" | "adjusted" | "alternative" {
  return "adjusted";
}
