/**
 * Phase 1 execution-loop entry — inactivity detection.
 */
export {
  InactivityDetectionEngine,
  scanForInactivity,
  scanAll,
  getLastInactivityScanAt,
  getCurrentInactivityForBlueprint,
  isBlueprintEligibleForInactivityScan,
  type CurrentInactivitySnapshot,
} from "../inactivity/InactivityDetectionEngine.js";
